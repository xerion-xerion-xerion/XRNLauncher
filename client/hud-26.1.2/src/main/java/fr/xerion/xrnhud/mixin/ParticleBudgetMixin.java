package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
@Mixin(net.minecraft.client.particle.ParticleEngine.class)public class ParticleBudgetMixin {
 @Inject(method="createParticle(Lnet/minecraft/core/particles/ParticleOptions;DDDDDD)Lnet/minecraft/client/particle/Particle;",at=@At("HEAD"),cancellable=true,require=1)private void xrn$budget(net.minecraft.core.particles.ParticleOptions effect,double x,double y,double z,double vx,double vy,double vz,CallbackInfoReturnable<net.minecraft.client.particle.Particle> ci){if(!fr.xerion.xrnhud.Optimisations.autorise(effect,x,y,z))ci.setReturnValue(null);}
}
