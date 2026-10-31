package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;
@Pseudo @Mixin(targets="dev.tr7zw.waveycapes.render.CustomCapeRenderer",remap=false)
public abstract class WaveyAtlasMixin {
 @Redirect(method="renderSmoothCape",at=@At(value="INVOKE",target="Ldev/tr7zw/waveycapes/render/CapeRenderer;uvSheetHeight()I"),remap=false,require=1)
 private int xrn$sheetHeight(@Coerce Object renderer,com.mojang.blaze3d.vertex.PoseStack matrices,com.mojang.blaze3d.vertex.VertexConsumer vertices,@Coerce Object player,@Coerce Object capeRenderer,float delta,int light){return fr.xerion.xrnhud.WaveyIntegration.sheetHeight(renderer,player);}
}
