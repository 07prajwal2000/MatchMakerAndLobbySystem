# Ops Folder contains configurations such as
- Reverse proxy/Load balancers
- Redis server

## Docker command for Redis stack server
```bash
docker run --name redis-stack --rm -p 6379:6379 -p 8001:8001 redis/redis-stack
```

## Docker command to spin-up Caddy as a reverse proxy (easy)
```bash
docker run --name caddyserver --rm -p 8000:8000 -v "${PWD}/Caddyfile:/etc/caddy/Caddyfile" caddy
```
## Docker command to spin-up Caddy traefik proxy
```bash
docker run --name traefiklb --rm -p 8000:8000 -v "${PWD}/traefik/config.yml:/etc/traefik/traefik.yml" -v "${PWD}/traefik/routes_config.yml:/app/routes_config.yml" traefik
```

## NOTE: Traefik requires 2 files, one for server config and other is routes provider (tells traefik what are the routes).