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
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;

/**
 * Accroche le logo du client au pseudo.
 *
 * <p>On ne projette rien a l ecran : on ajoute un caractere au nom
 * affiche, et c est le jeu qui le dessine, exactement a la bonne
 * place. C est la methode de Tier Tagger, et la raison pour laquelle
 * le logo reste colle au pseudo : plus de calcul de projection, donc
 * plus de derive quand la camera bouge.
 *
 * <p>La cible est PlayerEntity, et non Entity : PlayerEntity
 * surcharge getDisplayName() et n appelle jamais super, donc un mixin
 * pose sur Entity ne se declenche pas pour un joueur. C etait la
 * raison pour laquelle le logo n apparaitrait pas.
 *
 * <p>Seul le joueur local est concerne : on ne sait pas quels autres
 * joueurs utilisent ce client, le serveur ne transmet pas cette
 * information.
 */
@Mixin(Player.class)
public abstract class PlayerEntityMixin {

    private static final Logger LOGGER = LoggerFactory.getLogger("XRN HUD");

    /*  On ne dit qu une fois que le logo est pose : c est la trace qui
        permet de savoir, dans le log du jeu, si le mixin a reellement
        joue. Un mixin qui ne s applique pas ne casse rien, mais ne
        laisse aucune trace non plus.                                    */
    private static boolean signale = false;

    @Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true)
    private void xrn$ajouterLogo(CallbackInfoReturnable<Component> cir) {

        Component nom = cir.getReturnValue();
        if (nom == null) return;

        Minecraft client = Minecraft.getInstance();
        if (client.player == null) return;
        /*  Notre pseudo, toujours. Et celui des joueurs qu on sait
         equipes : le serveur ne dit pas qui a le mod, mais on peut
         le declarer soi-meme (voir Connus).                       */
        boolean moi = client.player == (Entity) (Object) this;
        if (!moi) {
            String pseudo = ((Player) (Object) this).getName().getString();
            if (!Connus.contient(((Player)(Object)this).getUUID(), pseudo)) return;
        }

        if (!signale) {
            signale = true;
            LOGGER.info("Logo XRN : actif, le pseudo est equipe (caractere U+{})",
                    String.format("%04X", (int) Logo.CARACTERE.charAt(0)));
        }

        var uuid=((Player)(Object)this).getUUID();String username=((Player)(Object)this).getName().getString();
        nom=moi?fr.xerion.xrnhud.NameTag.personnaliser(nom,username):fr.xerion.xrnhud.NameTag.distant(nom,username,uuid);
        boolean badge=moi?fr.xerion.xrnhud.NameTag.badge:fr.xerion.xrnhud.NameTag.badgeDistant(uuid);
        cir.setReturnValue(Logo.actif&&badge?Logo.decorer(nom):nom);
    }
}
