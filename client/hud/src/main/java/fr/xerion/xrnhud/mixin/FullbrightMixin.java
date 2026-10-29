package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.Eclairage;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;
import net.minecraft.client.render.LightmapTextureManager;import net.minecraft.client.render.GameRenderer;import net.minecraft.client.network.ClientPlayerEntity;import net.minecraft.entity.LivingEntity;import net.minecraft.entity.effect.*;import net.minecraft.registry.entry.RegistryEntry;
@Mixin(LightmapTextureManager.class)
public abstract class FullbrightMixin {
 @Redirect(method="update",at=@At(value="INVOKE",target="Lnet/minecraft/client/network/ClientPlayerEntity;hasStatusEffect(Lnet/minecraft/registry/entry/RegistryEntry;)Z"),require=1)
 private boolean xrn$vision(ClientPlayerEntity player,RegistryEntry<StatusEffect> effect){return Eclairage.actif()&&effect==StatusEffects.NIGHT_VISION||player.hasStatusEffect(effect);}
 @Redirect(method="update",at=@At(value="INVOKE",target="Lnet/minecraft/client/render/GameRenderer;getNightVisionStrength(Lnet/minecraft/entity/LivingEntity;F)F"),require=1)
 private float xrn$force(LivingEntity player,float dt){return Eclairage.actif()?1:GameRenderer.getNightVisionStrength(player,dt);}
}
