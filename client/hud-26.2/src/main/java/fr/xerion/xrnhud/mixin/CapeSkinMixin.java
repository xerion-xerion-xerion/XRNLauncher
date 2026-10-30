package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.*;import net.minecraft.client.Minecraft;import net.minecraft.client.player.AbstractClientPlayer;import net.minecraft.world.entity.player.PlayerSkin;import net.minecraft.resources.Identifier;import net.minecraft.core.ClientAsset;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
/** Make the chosen XRN cape visible through the standard skin API used by external renderers. */
@Mixin(AbstractClientPlayer.class)
public abstract class CapeSkinMixin {
 @Inject(method="getSkin",at=@At("RETURN"),cancellable=true,require=1)
 private void xrn$cape(CallbackInfoReturnable<PlayerSkin> ci){
  if(!CapeMouvement.externe())return;PlayerSkin skin=ci.getReturnValue();if(skin==null)return;var player=(AbstractClientPlayer)(Object)this;var client=Minecraft.getInstance();String chosen=client.player==player?Droits.equipe():Connus.cosmetique(player.getUUID());Identifier texture=Droits.texture(chosen);if(texture==null)return;
  Cape asset=new Cape(texture);ci.setReturnValue(new PlayerSkin(skin.body(),asset,new Cape(ElytraTextures.texture(chosen)),skin.model(),skin.secure()));
 }
 private record Cape(Identifier texture) implements ClientAsset.Texture {public Identifier id(){return texture;}public Identifier texturePath(){return texture;}}
}
