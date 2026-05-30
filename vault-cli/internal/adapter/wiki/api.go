package wiki

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"portal.works.prod/ssd/tools/sc/vcs/vcs-vault/internal/config"
)

const (
	defaultBase       = "https://portal.works.prod.sbt/swtr"
	defaultWorkerType = "WIKI"
)

type client struct {
	base        string
	token       string
	workerType  string
	pollStep    time.Duration
	pollTimeout time.Duration
	http        *http.Client
}

func newClient(src config.Source) (*client, error) {
	tokenVar := src.Env["token"]
	token := os.Getenv(tokenVar)
	if token == "" {
		return nil, fmt.Errorf("$%s is required for wiki source %q", tokenVar, src.Name)
	}

	base := defaultBase
	if bv := src.Env["base_url"]; bv != "" {
		if v := os.Getenv(bv); v != "" {
			base = strings.TrimRight(v, "/")
		}
	}

	workerType := defaultWorkerType
	if wt := os.Getenv("WIKI_WORKER_TYPE"); wt != "" {
		workerType = wt
	}

	pollStep := envDuration("POLL_INTERVAL", 3*time.Second)
	pollTimeout := envDuration("POLL_TIMEOUT", 120*time.Second)

	return &client{
		base:        base,
		token:       token,
		workerType:  workerType,
		pollStep:    pollStep,
		pollTimeout: pollTimeout,
		http:        &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// ── JSON types ────────────────────────────────────────────────────────────────

type hierarchyResp struct {
	Elements []hierarchyNode `json:"elements"`
}

type hierarchyNode struct {
	Element   pageElement     `json:"element"`
	ChildList []hierarchyNode `json:"childList"`
}

type pageElement struct {
	Code    string `json:"code"`
	Summary string `json:"summary"`
}

type unitResp struct {
	Info struct {
		UpdatedAt string `json:"updatedAt"`
	} `json:"info"`
}

type exportInitResp struct {
	FileExportID string `json:"fileExportId"`
}

type exportListResp struct {
	Content []struct {
		JobID  string `json:"jobId"`
		Status string `json:"status"`
		FileID string `json:"fileId"`
	} `json:"content"`
}

// ── API methods ───────────────────────────────────────────────────────────────

func (c *client) hierarchy(ctx context.Context, space string) ([]hierarchyNode, error) {
	url := c.base + "/extension/plugin/v2/rest/api/swtr_wiki_plugin/v1/wiki/unit/hierarchy"
	body := fmt.Sprintf(`{"filter":{"spaces":[%q]},"param":{"eager":true,"root":null}}`, space)

	var resp hierarchyResp
	if err := c.post(ctx, url, body, &resp); err != nil {
		return nil, err
	}
	return resp.Elements, nil
}

func (c *client) unitUpdatedAt(ctx context.Context, code string) string {
	url := c.base + "/extension/plugin/v2/rest/api/swtr_wiki_plugin/v2/wiki/unit/" + code
	var resp unitResp
	if err := c.get(ctx, url, &resp); err != nil {
		return ""
	}
	return resp.Info.UpdatedAt
}

func (c *client) initiateExport(ctx context.Context, space, code string) (string, error) {
	url := c.base + "/rest/api/export/v1"
	body := fmt.Sprintf(`{"workerType":%q,"fileFormat":"pdf","filters":{"spaces":[%q],"units":[%q]}}`,
		c.workerType, space, code)

	var resp exportInitResp
	if err := c.post(ctx, url, body, &resp); err != nil {
		return "", err
	}
	return resp.FileExportID, nil
}

func (c *client) pollExport(ctx context.Context, exportID string) (string, error) {
	url := c.base + "/rest/api/export/v1/list"
	body := fmt.Sprintf(`{"filters":{"workerType":%q},"page":{"page":0,"size":50}}`, c.workerType)

	deadline := time.Now().Add(c.pollTimeout)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}

		var resp exportListResp
		if err := c.post(ctx, url, body, &resp); err != nil {
			return "", err
		}
		for _, job := range resp.Content {
			if job.JobID != exportID {
				continue
			}
			switch job.Status {
			case "COMPLETED":
				return job.FileID, nil
			case "ERROR":
				return "", fmt.Errorf("export %s failed on server", exportID)
			}
		}
		time.Sleep(c.pollStep)
	}
	return "", fmt.Errorf("export %s timed out after %s", exportID, c.pollTimeout)
}

func (c *client) downloadPDF(ctx context.Context, fileID, destPath string) error {
	url := c.base + "/rest/api/export/v1/download/" + fileID
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	c.addHeaders(req, false)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download %s: HTTP %d", fileID, resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return os.WriteFile(destPath, data, 0o644)
}

// downloadPage recursively downloads a page and its children into cacheDir.
func (c *client) downloadPage(ctx context.Context, node hierarchyNode, cacheDir, space, relPath string, depth int) error {
	code := node.Element.Code
	summary := node.Element.Summary
	if code == "" {
		return nil
	}

	indent := strings.Repeat("  ", depth)
	fname := safeName(firstNonEmpty(summary, code))
	pagePath := fname
	if relPath != "" {
		pagePath = relPath + "/" + fname
	}
	fmt.Printf("%s↓ %s (%s)\n", indent, firstNonEmpty(summary, code), code)

	updatedAt := c.unitUpdatedAt(ctx, code)

	meta := pageMeta{
		Code:      code,
		Summary:   summary,
		UpdatedAt: updatedAt,
		Path:      pagePath,
		Space:     space,
	}
	metaJSON, _ := json.Marshal(meta)
	if err := os.WriteFile(fmt.Sprintf("%s/%s.meta.json", cacheDir, code), metaJSON, 0o644); err != nil {
		return fmt.Errorf("write meta %s: %w", code, err)
	}

	exportID, err := c.initiateExport(ctx, space, code)
	if err != nil || exportID == "" {
		fmt.Fprintf(os.Stderr, "%s  !! export initiation failed for %s\n", indent, code)
	} else {
		fmt.Printf("%s  ⧖ waiting for export %s...\n", indent, exportID)
		fileID, err := c.pollExport(ctx, exportID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s  !! %v\n", indent, err)
		} else {
			pdfPath := fmt.Sprintf("%s/%s.pdf", cacheDir, code)
			if err := c.downloadPDF(ctx, fileID, pdfPath); err != nil {
				fmt.Fprintf(os.Stderr, "%s  !! download failed for %s: %v\n", indent, code, err)
			} else {
				fmt.Printf("%s  ✓ saved %s.pdf\n", indent, code)
			}
		}
	}

	time.Sleep(500 * time.Millisecond)

	for _, child := range node.ChildList {
		if err := c.downloadPage(ctx, child, cacheDir, space, pagePath, depth+1); err != nil {
			fmt.Fprintf(os.Stderr, "%s  warn: %v\n", indent, err)
		}
	}
	return nil
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func (c *client) post(ctx context.Context, url, body string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBufferString(body))
	if err != nil {
		return err
	}
	c.addHeaders(req, true)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("POST %s: HTTP %d", url, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *client) get(ctx context.Context, url string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	c.addHeaders(req, false)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("GET %s: HTTP %d", url, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *client) addHeaders(req *http.Request, json bool) {
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Cookie", "api_swtr_as21=true")
	if json {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func safeName(s string) string {
	s = strings.Map(func(r rune) rune {
		if strings.ContainsRune(`\/:*?"<>|`, r) {
			return '_'
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if len(s) > 120 {
		s = s[:120]
	}
	return s
}

func envDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return def
	}
	return time.Duration(n) * time.Second
}
