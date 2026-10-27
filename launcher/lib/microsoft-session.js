'use strict';

// A Microsoft identity is not a Minecraft session. Only a token accepted by
// Minecraft's profile endpoint may be passed to the game.
function create(auth, persist) {
  const pending = new Map();
  async function validate(account) {
    if (!account || !['microsoft', 'xbox'].includes(account.type)) throw new Error('Reconnectez votre compte Microsoft pour jouer en ligne.');
    const key = account.id || account.name;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      let token = account.mcToken, profile;
      if (token) {
        try { profile = await auth.profile(token); } catch (error) {
          // A temporary outage must not rotate tokens or start an offline game.
          if (!/401|403/.test(String(error.message))) throw error;
          token = null;
        }
      }
      if (!profile) {
        if (!account.refreshToken) throw new Error('Session Minecraft expirée. Reconnectez-vous avec Microsoft.');
        const sisu=account.authProvider==='xbox-sisu-pkce' ? require('./auth-sisu') : null;
        const tokens = sisu ? await sisu.refresh(account.refreshToken) : await auth.refresh(account.refreshToken,account.authClientId);
        // Persist a rotated refresh token even if a later Minecraft step fails.
        if (tokens.refresh_token) { account = {...account, refreshToken:tokens.refresh_token}; persist(account); }
        token = sisu ? await sisu.minecraft(tokens) : await auth.toMinecraft(tokens.access_token);
        profile = await auth.profile(token);
      }
      if (!token || token === '0' || !/^[a-f0-9]{32}$/i.test(profile.id) || !profile.name) throw new Error('Minecraft n’a pas confirmé ce profil. Reconnectez-vous.');
      const fresh = {...account,type:'microsoft',name:profile.name,id:profile.id,uuid:profile.id,
        mcToken:token,userType:'msa',skinUrl:profile.skinUrl,capeUrl:profile.capeUrl,
        minecraftVerified:true,verifiedAt:Date.now(),savedAt:Date.now()};
      persist(fresh);
      return fresh;
    })();
    pending.set(key,task);
    try { return await task; } finally { pending.delete(key); }
  }
  return {validate};
}
module.exports = {create};
