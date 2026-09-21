# csv-analysis

Analyze CSV files and generate statistical data quality reports.

## Install

```sh
npx skills add codebytes/skills --skill csv-analysis
```

Reload your agent skills, then invoke `/csv-analysis`.

## Usage

Ask the agent to profile a CSV file, calculate column statistics, identify
quality issues, and produce a Markdown report. Python 3 is recommended for
deterministic analysis of larger files.

## Development

Run these commands inside the installed skill directory with Node.js 22.20+.

```sh
npm ci --ignore-scripts
npm test
npm run eval:lint
```

The deterministic test checks the portable skill shape. The Vally capability eval verifies that
the agent follows the workflow.

## License

MIT. See [LICENSE](LICENSE).
