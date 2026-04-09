
---

## 🏗️ Architecture cible

```
Client (HTTPS:443)
      ↓
   Nginx          ← SSL Termination ici UNIQUEMENT
      ↓ HTTP
  Docker (3200:80)
      ↓
  Application     ← doit reconstruire l'URL en HTTPS via X-Forwarded-Proto
      ↓
  Entra ID (OAuth2/OIDC)
```

---

## 🔒 Règles Nginx (non négociables)

### 1. SSL Termination sur Nginx uniquement
- Le trafic interne entre Nginx et Docker est en **HTTP plain**
- Ne jamais configurer HTTPS dans le container Docker
- Cela évite le double chiffrement

### 2. Configuration Nginx obligatoire

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/ssl/certs/example.crt;
    ssl_certificate_key /etc/ssl/private/example.key;

    location / {
        proxy_pass http://localhost:3200;   # HTTP, pas HTTPS

        # Headers obligatoires pour Entra ID
        proxy_set_header X-Forwarded-Proto $scheme;       # Transmet "https"
        proxy_set_header X-Forwarded-Host  $host;         # Transmet le domaine public
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header Host              $host;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

---

## 🐳 Configuration Docker

### Mapping de port imposé
```yaml
ports:
  - "3200:80"   # Externe:Interne — NE PAS MODIFIER
```

## 🔑 Configuration Entra ID (Azure AD)

### App Registration — règles strictes

| Paramètre | Valeur attendue |
|---|---|
| Redirect URI | `https://gprojet.groupe-itec.fr/auth/callback` ✅ |
| Type | Web |
| Implicit grant | Désactivé (utiliser PKCE ou client_secret) |

### URIs interdites dans Entra ID
- ❌ `http://example.com/callback` (HTTP refusé en prod)
- ❌ `http://localhost:3200/callback` (port interne invisible)
- ❌ `https://localhost:3200/callback` (idem)


---

## ⚙️ Configuration de l'application (selon le framework)

### Règle universelle
L'application doit **honorer `X-Forwarded-Proto`** pour reconstruire les URLs de callback en HTTPS. Sans cela, Entra ID recevra `http://` et rejettera le callback.

### Node.js / Express

```javascript
// OBLIGATOIRE — à placer avant toute route
app.set('trust proxy', 1);

// La redirect URI doit être construite depuis APP_BASE_URL, jamais depuis req.protocol
const CALLBACK_URL = `${process.env.APP_BASE_URL}/auth/callback`;
```

### Python / FastAPI

```python
# Dans le lancement uvicorn
# uvicorn main:app --proxy-headers --forwarded-allow-ips='127.0.0.1'

# Ou dans le code
from fastapi.middleware.trustedhost import TrustedHostMiddleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["example.com"])
```

### ASP.NET Core

```csharp
app.UseForwardedHeaders(new ForwardedHeadersOptions {
    ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost
});
// Placer AVANT app.UseAuthentication()
```

---

## 🔁 Flux d'authentification attendu

```
1. GET https://gprojet.groupe-itec/login
        ↓ Nginx forward HTTP → Docker:80
2. App redirige vers :
   https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
     ?client_id=...
     &redirect_uri=https://gprojet.groupe-itec/auth/callback   ← HTTPS obligatoire
     &response_type=code
     &scope=openid profile email

3. Entra ID authentifie l'utilisateur

4. Entra ID callback vers :
   https://example.com/auth/callback?code=...
        ↓ Nginx forward HTTP → Docker:80
5. App échange le code contre un token
   POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

6. Session créée ✅
```

---

## ✅ Checklist avant déploiement

- [ ] Nginx écoute sur 443 avec SSL valide
- [ ] `proxy_set_header X-Forwarded-Proto $scheme` présent dans Nginx
- [ ] Docker exposé en `3200:80` uniquement
- [ ] App configurée pour faire confiance au proxy (`trust proxy`)
- [ ] Redirect URI dans Entra ID App Registration en `https://`
- [ ] Aucune référence à `localhost:3200` dans les URLs de callback
- [ ] Redirect HTTP→HTTPS configuré dans Nginx (port 80)

---

## ⚠️ Erreurs courantes à éviter

| Symptôme | Cause probable | Solution |
|---|---|---|
| `AADSTS50011: redirect_uri mismatch` | App construit l'URL en `http://` | Ajouter `trust proxy` + vérifier `APP_BASE_URL` |
| `502 Bad Gateway` au démarrage | Container pas encore prêt | Normal, ajouter `healthcheck` dans docker-compose |
| Token valide mais session perdue | Cookie en HTTP seulement | Forcer `Secure` flag sur les cookies de session |
| Boucle de redirect infinie | `trust proxy` absent + redirect HTTPS actif dans l'app | Ne gérer le redirect HTTPS que dans Nginx |

---
