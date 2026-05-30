package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/config"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show sync status of all knowledge sources",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(cfgFile)
		if err != nil {
			return err
		}
		ctx := context.Background()
		for _, src := range cfg.Sources {
			a := adapterFor(src.Type)
			if a == nil {
				fmt.Printf("  %-20s [unknown type %q]\n", src.Name, src.Type)
				continue
			}
			st, err := a.Status(ctx, src)
			if err != nil {
				fmt.Printf("  %-20s error: %v\n", src.Name, err)
				continue
			}
			mark := "✗"
			if st.Cloned {
				mark = "✓"
			}
			fmt.Printf("  %s %-20s %s\n", mark, st.Name, st.Info)
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(statusCmd)
}
