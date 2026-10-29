package fr.xerion.xrnhud.mixin;

import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/**
 * Permet d'ajouter un rendu supplementaire a un joueur.
 *
 * <p>La methode du jeu est "final" : on ne peut pas la redéfinir par
 * un mixin, on ne peut que l'appeler. C'est ce que fait un invoker.
 */
@Mixin(LivingEntityRenderer.class)
public interface AddFeatureAccessor {

    @Invoker("addLayer")
    boolean xrn$addFeature(RenderLayer<?, ?> feature);
}
