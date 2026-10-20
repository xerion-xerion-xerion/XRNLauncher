/*  Point d entree des notifications, en Worker Cloudflare.

    C est la version « hebergee » du serveur local : gratuit, permanent,
    toujours allume, et accessible partout. Tu n as rien a maintenir.

    Installation
    ------------
    1. Dans Cloudflare : Workers & Pages > Create > Worker > Write code.
       Colle ce fichier, puis Deploy.
    2. Settings > Bindings > Add > KV Namespace, deux fois :
         MESSAGES      : le message a envoyer
         INSTALLATIONS : la liste des installations
    3. Dashboard > Workers > KV > ton namespace MESSAGES > Add :
         cle    : message
         valeur : le JSON du message (voir tools/notification-message.json)
    4. Pour changer le message plus tard : tu modifies la valeur de la
       cle « message » dans KV. C est tout.
    5. Ton adresse publique : https://NOM-DU-WORKER.workers.dev/notification.json
       Tu la mets dans notification.json, a la racine du launcher.

    Ce qui est note dans INSTALLATIONS : un identifiant anonyme, la
    version du launcher, et la date. Rien d autre.                       */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const json = (data, code = 200) => new Response(JSON.stringify(data), {
      status: code,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });

    if (url.pathname !== '/notification.json') {
      return json({ id: '' });
    }

    const id = url.searchParams.get('id') || '';
    const version = url.searchParams.get('v') || '';

    /*  On note l installation, si un namespace est lie. */
    if (env.INSTALLATIONS && id) {
      try {
        await env.INSTALLATIONS.put('install:' + id, JSON.stringify({
          quand: new Date().toISOString(),
          version: version
        }));
      } catch (e) { }
    }

    /*  Le message vient du namespace. */
    let message = null;
    try {
      const brut = env.MESSAGES ? await env.MESSAGES.get('message') : null;
      if (brut) message = JSON.parse(brut);
    } catch (e) { }

    /*  Un message peut viser certaines installations seulement : le champ
        "cible" liste les identifiants autorises. Sans ce champ, le message
        va a tout le monde.                                              */
    if (message && Array.isArray(message.cible) && message.cible.length) {
      if (!message.cible.includes(id)) message = null;
    }

    return json(message || { id: '' });
  }
};
