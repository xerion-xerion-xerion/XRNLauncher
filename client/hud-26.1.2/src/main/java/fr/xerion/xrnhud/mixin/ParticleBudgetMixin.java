package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;
/** Keep factory return values intact: firework emitters configure the returned spark. Only skip queueing its visual. */
@Mixin(net.minecraft.client.particle.ParticleEngine.class)public class ParticleBudgetMixin {
 @Redirect(method="createParticle(Lnet/minecraft/core/particles/ParticleOptions;DDDDDD)Lnet/minecraft/client/particle/Particle;",at=@At(value="INVOKE",target="Lnet/minecraft/client/particle/ParticleEngine;add(Lnet/minecraft/client/particle/Particle;)V"),require=1)
 private void xrn$queue(net.minecraft.client.particle.ParticleEngine manager,net.minecraft.client.particle.Particle particle,net.minecraft.core.particles.ParticleOptions effect,double x,double y,double z,double vx,double vy,double vz){if(fr.xerion.xrnhud.Optimisations.autorise(effect,x,y,z))manager.add(particle);}
}
