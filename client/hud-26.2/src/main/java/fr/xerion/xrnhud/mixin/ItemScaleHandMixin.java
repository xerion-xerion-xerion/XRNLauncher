package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import fr.xerion.xrnhud.TailleObjets;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemDisplayContext;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.SubmitNodeCollector;
@Mixin(net.minecraft.client.renderer.ItemInHandRenderer.class)
public abstract class ItemScaleHandMixin {
 @Inject(method="renderItem(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;I)V",at=@At("HEAD"),require=1)
 private void xrn$scale(LivingEntity entity,ItemStack stack,ItemDisplayContext mode,PoseStack matrices,SubmitNodeCollector queue,int light,CallbackInfo ci){float scale=TailleObjets.facteur(stack,false);matrices.pushPose();matrices.scale(scale,scale,scale);}
 @Inject(method="renderItem(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;I)V",at=@At("RETURN"),require=1)
 private void xrn$restore(LivingEntity entity,ItemStack stack,ItemDisplayContext mode,PoseStack matrices,SubmitNodeCollector queue,int light,CallbackInfo ci){matrices.popPose();}
}
