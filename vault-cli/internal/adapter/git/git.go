package git

import (
	"bytes"
	"context"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/adapter"
	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/config"
)

type Adapter struct{}

func New() *Adapter { return &Adapter{} }

func (a *Adapter) Clone(ctx context.Context, src config.Source) error {
	if isGitRepo(src.Path) {
		fmt.Printf("  skip %s: already cloned\n", src.Name)
		return nil
	}

	args := []string{"clone", "--no-checkout", "--filter=blob:none"}
	if src.Branch != "" {
		args = append(args, "--branch", src.Branch)
	}
	args = append(args, src.URL, src.Path)

	if err := runGit(ctx, src, args...); err != nil {
		return err
	}
	// runGit returned nil for an optional unreachable repo — dir won't exist
	if !isGitRepo(src.Path) {
		return nil
	}

	if len(src.SparseCheckout) > 0 {
		if err := setupSparseCheckout(ctx, src); err != nil {
			return err
		}
	} else {
		if err := runGit(ctx, src, "-C", src.Path, "checkout"); err != nil {
			return err
		}
	}

	return runPostProcess(src)
}

func (a *Adapter) Pull(ctx context.Context, src config.Source) error {
	if !isGitRepo(src.Path) {
		if src.Optional {
			fmt.Printf("  skip %s: not cloned\n", src.Name)
			return nil
		}
		return fmt.Errorf("%s: not cloned yet (run clone first)", src.Name)
	}

	if err := runGit(ctx, src, "-C", src.Path, "pull"); err != nil {
		return err
	}

	return runPostProcess(src)
}

func (a *Adapter) Status(ctx context.Context, src config.Source) (adapter.Status, error) {
	st := adapter.Status{Name: src.Name}
	if !isGitRepo(src.Path) {
		st.Info = "not cloned"
		return st, nil
	}
	st.Cloned = true
	out, err := exec.CommandContext(ctx, "git", "-C", src.Path, "log", "--oneline", "-1").Output()
	if err == nil {
		st.Info = strings.TrimSpace(string(out))
	}
	return st, nil
}

// isGitRepo returns true when path contains a .git entry (file or dir).
func isGitRepo(path string) bool {
	_, err := os.Stat(filepath.Join(path, ".git"))
	return err == nil
}

// runGit runs a git command, streaming stdout/stderr to the terminal.
// For optional sources any failure is printed as a warning and nil is returned.
func runGit(ctx context.Context, src config.Source, args ...string) error {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Stdout = os.Stdout

	var errBuf bytes.Buffer
	if src.Optional {
		cmd.Stderr = &errBuf
	} else {
		cmd.Stderr = os.Stderr
	}

	if err := cmd.Run(); err != nil {
		if src.Optional {
			msg := strings.TrimSpace(errBuf.String())
			fmt.Fprintf(os.Stderr, "  warn %s: %s\n", src.Name, firstLine(msg))
			return nil
		}
		return fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
	}
	return nil
}

func setupSparseCheckout(ctx context.Context, src config.Source) error {
	if err := runGit(ctx, src, "-C", src.Path, "sparse-checkout", "init", "--no-cone"); err != nil {
		return err
	}

	paths := strings.Join(src.SparseCheckout, "\n")
	cmd := exec.CommandContext(ctx, "git", "-C", src.Path, "sparse-checkout", "set", "--stdin")
	cmd.Stdin = strings.NewReader(paths)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("sparse-checkout set: %w", err)
	}

	return runGit(ctx, src, "-C", src.Path, "checkout")
}

func runPostProcess(src config.Source) error {
	for _, pp := range src.PostProcess {
		base := filepath.Join(src.Path, pp.Dir)
		var err error
		switch pp.Type {
		case "rename_ext":
			err = renameExt(base, pp.From, pp.To)
		case "replace_in_files":
			err = replaceInFiles(base, pp.Glob, pp.Pattern, pp.Replacement)
		default:
			return fmt.Errorf("unknown post_process type: %s", pp.Type)
		}
		if err != nil {
			return fmt.Errorf("post_process %s in %s: %w", pp.Type, base, err)
		}
	}
	return nil
}

func renameExt(dir, fromExt, toExt string) error {
	return filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		if strings.HasSuffix(path, fromExt) {
			return os.Rename(path, strings.TrimSuffix(path, fromExt)+toExt)
		}
		return nil
	})
}

func replaceInFiles(dir, glob, pattern, replacement string) error {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return fmt.Errorf("compile pattern %q: %w", pattern, err)
	}
	repl := []byte(replacement)

	return filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		matched, matchErr := filepath.Match(glob, filepath.Base(path))
		if matchErr != nil || !matched {
			return matchErr
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		updated := re.ReplaceAll(data, repl)
		if !bytes.Equal(updated, data) {
			return os.WriteFile(path, updated, 0o644)
		}
		return nil
	})
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}
