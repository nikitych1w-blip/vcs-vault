package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type PostProcess struct {
	Type        string `yaml:"type"`
	Dir         string `yaml:"dir"`
	From        string `yaml:"from"`
	To          string `yaml:"to"`
	Glob        string `yaml:"glob"`
	Pattern     string `yaml:"pattern"`
	Replacement string `yaml:"replacement"`
}

type Source struct {
	Name           string            `yaml:"name"`
	Description    string            `yaml:"description"`
	Type           string            `yaml:"type"`
	URL            string            `yaml:"url"`
	Path           string            `yaml:"path"`
	Branch         string            `yaml:"branch"`
	SparseCheckout []string          `yaml:"sparse_checkout"`
	PostProcess    []PostProcess     `yaml:"post_process"`
	Optional       bool              `yaml:"optional"`
	Space          string            `yaml:"space"`
	Env            map[string]string `yaml:"env"`
}

type Config struct {
	Sources []Source `yaml:"sources"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	return &cfg, nil
}
