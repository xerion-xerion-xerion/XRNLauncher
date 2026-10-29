package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.*;import net.minecraft.client.MinecraftClient;import net.minecraft.client.network.AbstractClientPlayerEntity;import net.minecraft.entity.player.SkinTextures;import net.minecraft.util.Identifier;import net.minecraft.util.AssetInfo;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
/** Make the chosen XRN cape visible through the standard skin API used by external renderers. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class CapeSkinMixin {
 @Inject(method="getSkin",at=@At("RETURN"),cancellable=true,require=1)
 private void xrn$cape(CallbackInfoReturnable<SkinTextures> ci){
  if(!CapeMouvement.externe())return;SkinTextures skin=ci.getReturnValue();if(skin==null)return;var player=(AbstractClientPlayerEntity)(Object)this;var client=MinecraftClient.getInstance();String chosen=client.player==player?Droits.equipe():Connus.cosmetique(player.getUuid());Identifier texture=Droits.texture(chosen);if(texture==null)return;
  Cape asset=new Cape(texture);ci.setReturnValue(new SkinTextures(skin.body(),asset,asset,skin.model(),skin.secure()));
 }
 private record Cape(Identifier texture) implements AssetInfo.TextureAsset {public Identifier id(){return texture;}public Identifier texturePath(){return texture;}}
}
