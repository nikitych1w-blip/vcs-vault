package adapter

import (
	"context"

	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/config"
)

type Status struct {
	Name   string
	Cloned bool
	Info   string
}

type Adapter interface {
	Clone(ctx context.Context, src config.Source) error
	Pull(ctx context.Context, src config.Source) error
	Status(ctx context.Context, src config.Source) (Status, error)
}
