package wiki

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/adapter"
	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/config"
)

type Adapter struct{}

func New() *Adapter { return &Adapter{} }

func (a *Adapter) Clone(ctx context.Context, src config.Source) error {
	return a.sync(ctx, src)
}

func (a *Adapter) Pull(ctx context.Context, src config.Source) error {
	return a.sync(ctx, src)
}

func (a *Adapter) Status(_ context.Context, src config.Source) (adapter.Status, error) {
	st := adapter.Status{Name: src.Name}
	info, err := os.Stat(src.Path)
	if err != nil || !info.IsDir() {
		st.Info = "not synced"
		return st, nil
	}
	st.Cloned = true
	var count int
	_ = filepath.WalkDir(src.Path, func(_ string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() && filepath.Ext(d.Name()) == ".md" {
			count++
		}
		return nil
	})
	st.Info = fmt.Sprintf("%d markdown files", count)
	return st, nil
}

func (a *Adapter) sync(ctx context.Context, src config.Source) error {
	if src.Space == "" {
		return fmt.Errorf("wiki source %q missing required field 'space'", src.Name)
	}

	c, err := newClient(src)
	if err != nil {
		return err
	}

	cacheDir := filepath.Join(".wiki-cache", src.Space)
	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return fmt.Errorf("create cache dir: %w", err)
	}

	fmt.Printf("  fetching hierarchy for space %q...\n", src.Space)
	roots, err := c.hierarchy(ctx, src.Space)
	if err != nil {
		return fmt.Errorf("hierarchy: %w", err)
	}
	fmt.Printf("  found %d root page(s)\n", len(roots))

	for _, node := range roots {
		if err := c.downloadPage(ctx, node, cacheDir, src.Space, "", 0); err != nil {
			fmt.Fprintf(os.Stderr, "  warn: %v\n", err)
		}
	}

	fmt.Printf("  converting PDFs → markdown in %s...\n", src.Path)
	if err := convertCache(cacheDir, src.Path, src.Space); err != nil {
		return fmt.Errorf("convert: %w", err)
	}
	return nil
}

// ── convert ───────────────────────────────────────────────────────────────────

type pageMeta struct {
	Code      string `json:"code"`
	Summary   string `json:"summary"`
	UpdatedAt string `json:"updatedAt"`
	Path      string `json:"path"`
	Space     string `json:"space"`
}

func convertCache(cacheDir, outDir, space string) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}

	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return err
	}

	total, ok := 0, 0
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".meta.json") {
			continue
		}
		total++

		metaPath := filepath.Join(cacheDir, e.Name())
		raw, err := os.ReadFile(metaPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  !! read %s: %v\n", metaPath, err)
			continue
		}
		var meta pageMeta
		if err := json.Unmarshal(raw, &meta); err != nil {
			fmt.Fprintf(os.Stderr, "  !! parse %s: %v\n", metaPath, err)
			continue
		}

		fmt.Printf("  → %s\n", meta.Path)

		// resolve output path
		dir := filepath.Dir(meta.Path)
		if dir == "." {
			dir = ""
		}
		pageDir := filepath.Join(outDir, dir)
		if err := os.MkdirAll(pageDir, 0o755); err != nil {
			return err
		}
		mdPath := filepath.Join(pageDir, filepath.Base(meta.Path)+".md")

		pdfPath := filepath.Join(cacheDir, meta.Code+".pdf")
		if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "  !! PDF not found for %s\n", meta.Code)
			stub := fmt.Sprintf("# %s\n\n_PDF not found._\n", firstNonEmpty(meta.Summary, meta.Code))
			_ = os.WriteFile(mdPath, []byte(stub), 0o644)
			continue
		}

		body, err := pdfToMarkdown(pdfPath)
		if err != nil {
			body = "_No content._"
		}

		content := buildPage(meta, space, body)
		if err := os.WriteFile(mdPath, []byte(content), 0o644); err != nil {
			return err
		}
		ok++
	}

	index := fmt.Sprintf("---\ntitle: \"Wiki — %s\"\ntags: [SC, wiki, %s]\nsource: sberwiki\n---\n\n# Wiki space: %s\n\nSynced from sberwiki. See child pages for content.\n",
		space, space, space)
	_ = os.WriteFile(filepath.Join(outDir, "INDEX.md"), []byte(index), 0o644)

	fmt.Printf("  done. converted %d/%d pages → %s\n", ok, total, outDir)
	return nil
}

func pdfToMarkdown(pdfPath string) (string, error) {
	cmd := exec.Command("pandoc", "-f", "pdf", "-t", "markdown_strict", "--wrap=none", pdfPath)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return "", err
	}
	return out.String(), nil
}

func buildPage(meta pageMeta, space, body string) string {
	updated := ""
	if len(meta.UpdatedAt) >= 10 {
		updated = meta.UpdatedAt[:10]
	}
	title := strings.ReplaceAll(meta.Summary, `"`, `'`)
	fm := fmt.Sprintf("---\ntitle: \"%s\"\ncode: %s\nspace: %s\nupdated: %s\ntags: [SC, wiki, %s]\nsource: sberwiki\n---\n\n",
		title, meta.Code, space, updated, space)
	return fm + body
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
