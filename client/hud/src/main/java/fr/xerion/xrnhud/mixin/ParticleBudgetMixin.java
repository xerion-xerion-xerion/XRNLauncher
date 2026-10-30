package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
@Mixin(net.minecraft.client.particle.ParticleManager.class)public class ParticleBudgetMixin {
 @Inject(method="addParticle(Lnet/minecraft/particle/ParticleEffect;DDDDDD)Lnet/minecraft/client/particle/Particle;",at=@At("HEAD"),cancellable=true,require=1)private void xrn$budget(net.minecraft.particle.ParticleEffect effect,double x,double y,double z,double vx,double vy,double vz,CallbackInfoReturnable<net.minecraft.client.particle.Particle> ci){if(!fr.xerion.xrnhud.Optimisations.autorise(effect,x,y,z))ci.setReturnValue(null);}
}
