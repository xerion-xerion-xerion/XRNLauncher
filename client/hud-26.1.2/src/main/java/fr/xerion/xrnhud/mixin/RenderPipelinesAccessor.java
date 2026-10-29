package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.gen.Invoker;import com.mojang.blaze3d.pipeline.RenderPipeline;
@Mixin(net.minecraft.client.renderer.RenderPipelines.class)
public interface RenderPipelinesAccessor {@Invoker("register") static RenderPipeline xrn$register(RenderPipeline pipeline){throw new AssertionError();}}
