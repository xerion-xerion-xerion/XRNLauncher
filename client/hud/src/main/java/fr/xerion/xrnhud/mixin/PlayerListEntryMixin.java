package fr.xerion.xrnhud.mixin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayNetworkHandler;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.text.Text;

import fr.xerion.xrnhud.Connus;
import fr.xerion.xrnhud.Logo;

/**
 * Accroche le logo du client dans la liste des joueurs ( touche Tab ).
 *
 * <p>Meme mecanique que pour le nametag : on ajoute un caractere au
 * nom affiche, et c est le jeu qui le dessine a la bonne place.
 *
 * <p>Comme sur un nametag, seul le joueur local est concerne : on ne
 * sait pas quels autres joueurs utilisent ce client.
 */
@Mixin(PlayerListEntry.class)
public abstract class PlayerListEntryMixin {

    private static final Logger LOGGER = LoggerFactory.getLogger("XRN HUD");

    private static boolean signale = false;

    @Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true)
    private void xrn$ajouterLogo(CallbackInfoReturnable<Text> cir) {


        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null) return;

        /*  On compare par identite avec l entree de liste du joueur
            local. On evite ainsi GameProfile, dont l API change entre
            les versions d authlib : celle du jeu et celle du
            compilateur ne sont pas les memes.                              */
        ClientPlayNetworkHandler reseau = client.getNetworkHandler();
        if (reseau == null) return;

        /*  Notre ligne, ou celle d un joueur qu on sait equipe. Le
            serveur ne dit pas qui a le mod : on peut le declarer
            soi-meme (voir Connus).                                   */
        boolean moi = reseau.getPlayerListEntry(client.player.getUuid()) == (PlayerListEntry) (Object) this;
        if (!moi) {
            String nom = ((PlayerListEntry) (Object) this).getProfile().name();
            if (!Connus.contient(((PlayerListEntry)(Object)this).getProfile().id(), nom)) return;
        }

        /*  Le serveur ne donne pas toujours de nom personnalise : dans
            ce cas la liste affiche le pseudo du profil. Comme c est
            notre propre ligne, on reprend le pseudo du joueur local,
            ce qui evite de passer par GameProfile.                       */
        Text nom = cir.getReturnValue();
        if (nom == null) nom = Text.literal(((PlayerListEntry)(Object)this).getProfile().name());
        if (nom == null) return;

        if (!signale) {
            signale = true;
            LOGGER.info("Logo XRN : actif dans la liste des joueurs");
        }

        var uuid=((PlayerListEntry)(Object)this).getProfile().id();String username=((PlayerListEntry)(Object)this).getProfile().name();
        nom=moi?fr.xerion.xrnhud.NameTag.personnaliser(nom,username):fr.xerion.xrnhud.NameTag.distant(nom,username,uuid);
        boolean badge=moi?fr.xerion.xrnhud.NameTag.badge:fr.xerion.xrnhud.NameTag.badgeDistant(uuid);
        cir.setReturnValue(Logo.decorerPrime(nom,fr.xerion.xrnhud.PrimeClient.actif(uuid),Logo.actif&&badge));
    }
}
