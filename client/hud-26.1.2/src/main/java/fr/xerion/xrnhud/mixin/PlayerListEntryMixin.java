package fr.xerion.xrnhud.mixin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import fr.xerion.xrnhud.Connus;
import fr.xerion.xrnhud.Logo;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Component;

/**
 * Accroche le logo du client dans la liste des joueurs ( touche Tab ).
 *
 * <p>Meme mecanique que pour le nametag : on ajoute un caractere au
 * nom affiche, et c est le jeu qui le dessine a la bonne place.
 *
 * <p>Comme sur un nametag, seul le joueur local est concerne : on ne
 * sait pas quels autres joueurs utilisent ce client.
 */
@Mixin(PlayerInfo.class)
public abstract class PlayerListEntryMixin {

    private static final Logger LOGGER = LoggerFactory.getLogger("XRN HUD");

    private static boolean signale = false;

    @Inject(method = "getTabListDisplayName", at = @At("RETURN"), cancellable = true)
    private void xrn$ajouterLogo(CallbackInfoReturnable<Component> cir) {


        Minecraft client = Minecraft.getInstance();
        if (client.player == null) return;

        /*  On compare par identite avec l entree de liste du joueur
            local. On evite ainsi GameProfile, dont l API change entre
            les versions d authlib : celle du jeu et celle du
            compilateur ne sont pas les memes.                              */
        ClientPacketListener reseau = client.getConnection();
        if (reseau == null) return;

        /*  Notre ligne, ou celle d un joueur qu on sait equipe. Le
            serveur ne dit pas qui a le mod : on peut le declarer
            soi-meme (voir Connus).                                   */
        boolean moi = reseau.getPlayerInfo(client.player.getUUID()) == (PlayerInfo) (Object) this;
        if (!moi) {
            String nom = ((PlayerInfo) (Object) this).getProfile().name();
            if (!Connus.contient(((PlayerInfo)(Object)this).getProfile().id(), nom)) return;
        }

        /*  Le serveur ne donne pas toujours de nom personnalise : dans
            ce cas la liste affiche le pseudo du profil. Comme c est
            notre propre ligne, on reprend le pseudo du joueur local,
            ce qui evite de passer par GameProfile.                       */
        Component nom = cir.getReturnValue();
        if (nom == null) nom = Component.literal(((PlayerInfo)(Object)this).getProfile().name());
        if (nom == null) return;

        if (!signale) {
            signale = true;
            LOGGER.info("Logo XRN : actif dans la liste des joueurs");
        }

        var uuid=((PlayerInfo)(Object)this).getProfile().id();String username=((PlayerInfo)(Object)this).getProfile().name();
        nom=moi?fr.xerion.xrnhud.NameTag.personnaliser(nom,username):fr.xerion.xrnhud.NameTag.distant(nom,username,uuid);
        boolean badge=moi?fr.xerion.xrnhud.NameTag.badge:fr.xerion.xrnhud.NameTag.badgeDistant(uuid);
        cir.setReturnValue(Logo.decorerPrime(nom,fr.xerion.xrnhud.PrimeClient.actif(uuid),Logo.actif&&badge));
    }
}
