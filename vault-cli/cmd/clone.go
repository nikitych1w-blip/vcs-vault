package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/adapter"
	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/config"
)

var cloneCmd = &cobra.Command{
	Use:   "clone [name...]",
	Short: "Clone knowledge sources (all or specific by name)",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(cfgFile)
		if err != nil {
			return err
		}
		sources := filterSources(cfg.Sources, args)
		ctx := context.Background()
		return runEach(ctx, sources, func(a adapter.Adapter, src config.Source) error {
			fmt.Printf("→ clone [%s] %s\n", src.Type, src.Name)
			return a.Clone(ctx, src)
		})
	},
}

func init() {
	rootCmd.AddCommand(cloneCmd)
}
