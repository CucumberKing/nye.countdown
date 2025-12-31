FROM caddy:2-alpine

COPY index.html /usr/share/caddy/index.html
COPY manifest.json /usr/share/caddy/manifest.json
COPY sw.js /usr/share/caddy/sw.js
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

