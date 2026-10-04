# Connect grammar review

Create `.env.local` in this project and set `OPENAI_API_KEY` to your OpenAI API key. Keep any existing Supabase settings in that file. `.env.local` is ignored by Git; never put the key in a `VITE_` variable or browser storage.

`OPENAI_ASSESS_MODEL` defaults to `gpt-4.1-mini`. Set it only to a model your API key can access and that supports the Responses API with strict structured output.

The local server reads these settings when the grammar endpoint is called. Return to sentence practice and press **Reconnect grammar review** to retry your existing draft. `GET /api/assess` returns only whether a key is configured; a successful sentence review confirms provider access.

For production, set these server environment variables in the hosting project and redeploy. Local `.env.local` settings are not production configuration.

Missing configuration, rejected credentials, an unavailable model, depleted API credit, rate limits, and timeouts now have separate recovery messages. An unavailable reviewer never marks a draft as correct or wrong. Textbook matching remains available for book-based practice.
