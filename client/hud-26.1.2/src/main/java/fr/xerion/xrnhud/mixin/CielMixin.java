package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import net.minecraft.client.renderer.SkyRenderer;import net.minecraft.client.renderer.texture.AbstractTexture;import fr.xerion.xrnhud.Ciel;
@Mixin(SkyRenderer.class)
public abstract class CielMixin {
 @Shadow @Final private AbstractTexture endSkyTexture;
 @Shadow public abstract void renderEndSky();
 @Unique private boolean xrn$sky;
 @Unique private com.mojang.blaze3d.buffers.GpuBuffer xrn$buffer;
 @Shadow @Final private com.mojang.blaze3d.buffers.GpuBuffer endSkyBuffer;
 @Redirect(method="renderEndSky",at=@At(value="FIELD",target="Lnet/minecraft/client/renderer/SkyRenderer;endSkyBuffer:Lcom/mojang/blaze3d/buffers/GpuBuffer;"),require=1)
 private com.mojang.blaze3d.buffers.GpuBuffer xrn$vertices(SkyRenderer owner){return xrn$sky?xrn$buffer:endSkyBuffer;}
 @Inject(method="close",at=@At("HEAD"))
 private void xrn$close(CallbackInfo ci){if(xrn$buffer!=null){xrn$buffer.close();xrn$buffer=null;}}
 @Inject(method="renderSkyDisc",at=@At("HEAD"),cancellable=true,require=1)
 private void xrn$render(int color,CallbackInfo ci){if(!Ciel.disponible())return;Ciel.preparer();if(xrn$buffer==null)xrn$buffer=Ciel.creerBuffer();xrn$sky=true;try{renderEndSky();}finally{xrn$sky=false;}ci.cancel();}
 @Redirect(method="renderEndSky",at=@At(value="FIELD",target="Lnet/minecraft/client/renderer/SkyRenderer;endSkyTexture:Lnet/minecraft/client/renderer/texture/AbstractTexture;"),require=1)
 private AbstractTexture xrn$texture(SkyRenderer owner){return xrn$sky?Ciel.texture():endSkyTexture;}
 @ModifyArg(method="renderEndSky",at=@At(value="INVOKE",target="Lnet/minecraft/client/renderer/DynamicUniforms;writeTransform(Lorg/joml/Matrix4fc;Lorg/joml/Vector4fc;Lorg/joml/Vector3fc;Lorg/joml/Matrix4fc;)Lcom/mojang/blaze3d/buffers/GpuBufferSlice;"),index=1,require=1)
 private org.joml.Vector4fc xrn$color(org.joml.Vector4fc original){return xrn$sky?Ciel.couleur():original;}
 @ModifyArg(method="renderEndSky",at=@At(value="INVOKE",target="Lnet/minecraft/client/renderer/DynamicUniforms;writeTransform(Lorg/joml/Matrix4fc;Lorg/joml/Vector4fc;Lorg/joml/Vector3fc;Lorg/joml/Matrix4fc;)Lcom/mojang/blaze3d/buffers/GpuBufferSlice;"),index=0,require=1)
 private org.joml.Matrix4fc xrn$animation(org.joml.Matrix4fc original){return xrn$sky?Ciel.matrice(original):original;}
 @Inject(method="renderSunMoonAndStars",at=@At("HEAD"),cancellable=true,require=1)
 private void xrn$astres(com.mojang.blaze3d.vertex.PoseStack matrix,float a,float b,float d,net.minecraft.world.level.MoonPhase phase,float e,float f,CallbackInfo ci){if(Ciel.disponible()&&!Ciel.astres)ci.cancel();}
 @ModifyArg(method="renderEndSky",at=@At(value="INVOKE",target="Lcom/mojang/blaze3d/systems/RenderSystem$AutoStorageIndexBuffer;getBuffer(I)Lcom/mojang/blaze3d/buffers/GpuBuffer;"),index=0,require=1)
 private int xrn$indices(int count){return xrn$sky?Ciel.INDICES:count;}
 @ModifyArg(method="renderEndSky",at=@At(value="INVOKE",target="Lcom/mojang/blaze3d/systems/RenderPass;drawIndexed(IIII)V"),index=2,require=1)
 private int xrn$drawCount(int count){return xrn$sky?Ciel.INDICES:count;}
}
