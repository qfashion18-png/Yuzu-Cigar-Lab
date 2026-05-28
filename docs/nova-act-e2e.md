# Nova Act Cigar Enrichment E2E

This harness runs a guarded Nova Act browser pass to propose missing cigar metadata. It does not write to the catalog, humidor, or database. Treat every output as a review artifact.

## Setup

Install the Python SDK in the environment where the run will happen:

```powershell
python -m pip install -r requirements-nova-act.txt
```

Set a local Nova Act API key from `https://nova.amazon.com/act`:

```powershell
$env:NOVA_ACT_API_KEY = "replace_me"
```

Or use AWS IAM with a Nova Act workflow definition. Do not put AWS access keys
into `NOVA_ACT_API_KEY`; keep them in normal AWS credential variables or a
profile, then run with `--auth iam`.

Create the workflow definition once per AWS account/region:

```powershell
aws nova-act create-workflow-definition `
  --name ycc-cigar-enrichment-e2e `
  --description "Yuzu cigar metadata enrichment e2e" `
  --region us-east-1
```

Optional browser setup:

```powershell
playwright install chrome
```

If Playwright browser installation fails because the local certificate store
cannot validate the download host, and Chrome is already installed, set
`NOVA_ACT_SKIP_PLAYWRIGHT_INSTALL=1` for the run so Nova Act uses the installed
Chrome channel.

## Dry Run

Inspect the exact prompt, source allowlist, output path, and review policy without importing Nova Act or opening a browser:

```powershell
python scripts/nova_act_cigar_enrichment_e2e.py --dry-run
```

## Live Run

Run the default Padron smoke case:

```powershell
npm run nova-act:e2e
```

Run with AWS IAM/workflow auth:

```powershell
python scripts/nova_act_cigar_enrichment_e2e.py `
  --auth iam `
  --workflow-definition-name ycc-cigar-enrichment-e2e `
  --model-id nova-act-preview `
  --aws-region us-east-1
```

If an allowed source page has a bad TLS chain, retry that source with
`--ignore-https-errors`. Leave it off for normal runs.

Run a specific cigar/source pair:

```powershell
python scripts/nova_act_cigar_enrichment_e2e.py `
  --cigar "Fuente Fuente OpusX Robusto" `
  --source-url "https://arturofuente.com/our-cigars/"
```

The result is written to `output/nova-act-cigar-enrichment-e2e.json` by default. The `output/` directory is ignored by git.

## Safety Model

- Source pages are explicit, and Nova Act is instructed to stay on the same allowed domains.
- A state guardrail blocks browser observations that move off the allowed source domains.
- File open and file upload access are disabled.
- The prompt forbids logins, form submissions, purchases, subscriptions, downloads, uploads, and checkout flows.
- Every non-null extracted field must include a source URL and short evidence phrase.
- Outputs are proposals only and require human review before any catalog or member data changes.
