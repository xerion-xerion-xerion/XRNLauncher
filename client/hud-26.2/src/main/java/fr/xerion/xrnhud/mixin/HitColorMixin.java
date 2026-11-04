package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
@Mixin(net.minecraft.client.renderer.texture.OverlayTexture.class)
public abstract class HitColorMixin implements fr.xerion.xrnhud.HitColorTexture {
 @Shadow @Final private net.minecraft.client.renderer.texture.DynamicTexture texture;@Unique private int xrn$last=Integer.MIN_VALUE;
 @Unique public void xrn$applyHurtColor(){int pixel=fr.xerion.xrnhud.HitColor.pixel();if(pixel==xrn$last)return;var image=texture.getPixels();if(image==null)return;for(int y=0;y<8;y++)for(int x=0;x<16;x++)image.setPixel(x,y,pixel);texture.upload();xrn$last=pixel;}
}
