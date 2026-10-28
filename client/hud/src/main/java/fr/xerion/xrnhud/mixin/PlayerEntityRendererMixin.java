package fr.xerion.xrnhud.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.util.Identifier;

import fr.xerion.xrnhud.Droits;

/**
 * La cape du client, portee par le joueur.
 *
 * <p>La methode retenue est la plus fiable possible : on ne dessine
 * pas la cape nous-memes. On remplace, dans l etat de rendu du
 * joueur, la texture de cape par la notre. Le jeu fait ensuite tout
 * le travail : la bonne forme, le bon pli, l animation au vent, une
 * seule cape visible.
 *
 * <p>C est aussi ce qui remplace la cape du compte (celle de
 * Mojang, d Essential) : une seule cape s affiche, la notre quand
 * elle est portee.
 *
 * <p>Le descripteur de la methode est important : son erasure passe
 * par PlayerLikeEntity. Avec un autre type, l injection ne
 * s appliquait pas du tout, et silencieusement.
 */
@Mixin(PlayerEntityRenderer.class)
public abstract class PlayerEntityRendererMixin {

    @Inject(
            method = "updateRenderState(Lnet/minecraft/entity/PlayerLikeEntity;Lnet/minecraft/client/render/entity/state/PlayerEntityRenderState;F)V",
            at = @At("RETURN"))
    private void xrn$poserCape(net.minecraft.entity.PlayerLikeEntity entity,
                               PlayerEntityRenderState state, float tickDelta, CallbackInfo ci) {
        if (System.getProperty("XRNPasCape") != null) return;
        try {
            net.minecraft.client.MinecraftClient client = net.minecraft.client.MinecraftClient.getInstance();
            String porte;
            if (client.player != null && entity == client.player) {
                /*  Notre cape : celle que nous avons equipee. */
                porte = Droits.equipe();
            } else {
                /*  Les autres : ce que l annuaire dit qu ils portent. */
                porte = fr.xerion.xrnhud.Connus.cosmetique(entity.getUuid());
            }

            /*  Seuls les capes se portent : une texture de cape du jeu. */
            Identifier texture = Droits.texture(porte);
            if (texture == null) return;

            /*  Le remplacement : meme skin, meme modele de corps, mais
                la texture de cape est la notre.                          */
            net.minecraft.entity.player.SkinTextures skin = state.skinTextures;
            if (skin == null) return;
            AssetCape notreCape = new AssetCape(texture);
            state.skinTextures = new net.minecraft.entity.player.SkinTextures(
                    skin.body(), notreCape, skin.elytra(), skin.model(), skin.secure());
            state.capeVisible = true;
        } catch (Throwable t) {
            /*  Une cape absente n est pas un jeu casse. */
        }
    }

    /** Le pseudo du joueur dont on dessine l etat. */
    private static String nomDuJoueur(net.minecraft.entity.PlayerLikeEntity entity) {
        try {
            if (entity instanceof net.minecraft.entity.player.PlayerEntity) {
                return ((net.minecraft.entity.player.PlayerEntity) entity).getName().getString();
            }
        } catch (Throwable t) { }
        return "";
    }

    /**
     * Un actif de texture en une seule classe : le jeu demande un
     * identifiant et un chemin, on lui repond tous les deux avec
     * celui du cosmetique.
     */
    private static final class AssetCape implements net.minecraft.util.AssetInfo.TextureAsset {
        private final Identifier chemin;

        AssetCape(Identifier chemin) {
            this.chemin = chemin;
        }

        @Override
        public Identifier id() {
            return this.chemin;
        }

        @Override
        public Identifier texturePath() {
            return this.chemin;
        }
    }
}
