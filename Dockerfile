FROM node:22 AS base
RUN useradd -m -u 1001 app
USER app
WORKDIR /code

COPY --chown=app:app package*.json .
RUN npm ci

# Create migrator image
FROM base AS migrator

COPY --chown=app:app supabase/ supabase/
RUN mv supabase/migrator-config.toml supabase/config.toml

CMD ["npx", "supabase", "migration", "up"]

# Build the prod bundle to be served from Nginx
FROM base AS production

COPY --chown=app:app . .
EXPOSE 80
CMD ["npm", "exec", "vite", "--port", "80"]
