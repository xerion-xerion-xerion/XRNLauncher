# Publier le site

Le dossier `site-xrnlauncher` contient un seul fichier : `index.html`.

---

## 1. Crée le dépôt

Sur github.com → **New repository**

- Nom : `XRNLauncher`
- Coche **Add a README** (sinon GitHub refuse le push)
- Mets-le en **Public** (indispensable pour GitHub Pages)

---

## 2. Envoie le fichier

Dans le terminal, à l'intérieur du dossier `site-xrnlauncher` :

```bash
git init
git add index.html
git commit -m "Site XRNLauncher"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/XRNLauncher.git
git push -u origin main
```

Remplace `TON-PSEUDO` par ton pseudo GitHub.

---

## 3. Active GitHub Pages

Dans le dépôt → onglet **Settings** → **Pages** (menu de gauche)

- **Source** : `Deploy from a branch`
- **Branch** : `main` · dossier `/ (root)`
- **Save**

GitHub publie le site en 1-2 minutes sur :

```
https://TON-PSEUDO.github.io/XRNLauncher/
```

---

## 4. Mets le lien du zip

Le zip fait 206 Mo, donc il ne peut **pas** être mis dans le dépôt (GitHub bloque tout au-dessus de 100 Mo).
Il faut passer par une **Release** :

1. Dans le dépôt → **Releases** (menu de gauche) → **Draft a new release**
2. **Choose a tag** → crée `v3.5.0`
3. Titre : `XRNLauncher 3.5.0`
4. Attache le zip : glisse `XRNLauncher-v3.5.0-win-x64.zip` dans la zone
5. **Publish release**

Le lien de téléchargement devient :

```
https://github.com/TON-PSEUDO/XRNLauncher/releases/latest/download/XRNLauncher-v3.5.0-win-x64.zip
```

---

## 5. Remplace le lien dans le site

Ouvre `index.html`, remplace **partout** `TON-PSEUDO` par ton vrai pseudo GitHub
(il y a 3 occurrences : le bouton de téléchargement, le second bouton en bas, et le lien « Code source »).

Puis :

```bash
git add index.html
git commit -m "Lien de telechargement"
git push
```

Le site est à jour en 30 secondes.

---

## Résumé

| Où | Quoi |
|---|---|
| `index.html` à la racine du dépôt | le site |
| Release GitHub | le zip de 206 Mo |
| Settings → Pages | active la publication |

Le zip est déjà prêt sur ton Bureau :
`<votre nom d utilisateur>\Desktop\XRNLauncher-v3.5.0-win-x64.zip`