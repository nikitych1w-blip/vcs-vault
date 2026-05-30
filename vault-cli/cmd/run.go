package cmd

import (
	"context"
	"fmt"
	"os"

	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/adapter"
	gitadapter "portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/adapter/git"
	wikiadapter "portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/adapter/wiki"
	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/config"
)

func adapterFor(typ string) adapter.Adapter {
	switch typ {
	case "git":
		return gitadapter.New()
	case "wiki":
		return wikiadapter.New()
	default:
		return nil
	}
}

func filterSources(sources []config.Source, names []string) []config.Source {
	if len(names) == 0 {
		return sources
	}
	set := make(map[string]bool, len(names))
	for _, n := range names {
		set[n] = true
	}
	var out []config.Source
	for _, s := range sources {
		if set[s.Name] {
			out = append(out, s)
		}
	}
	return out
}

func runEach(ctx context.Context, sources []config.Source, do func(adapter.Adapter, config.Source) error) error {
	failed := 0
	for _, src := range sources {
		a := adapterFor(src.Type)
		if a == nil {
			fmt.Fprintf(os.Stderr, "✗ %s: unknown adapter type %q\n", src.Name, src.Type)
			failed++
			continue
		}
		if err := do(a, src); err != nil {
			fmt.Fprintf(os.Stderr, "✗ %s: %v\n", src.Name, err)
			failed++
		}
	}
	if failed > 0 {
		return fmt.Errorf("%d source(s) failed", failed)
	}
	return nil
}
