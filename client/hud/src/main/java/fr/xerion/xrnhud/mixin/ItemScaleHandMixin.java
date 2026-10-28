package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import fr.xerion.xrnhud.TailleObjets;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.ItemDisplayContext;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
@Mixin(net.minecraft.client.render.item.HeldItemRenderer.class)
public abstract class ItemScaleHandMixin {
 @Inject(method="renderItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/item/ItemStack;Lnet/minecraft/item/ItemDisplayContext;Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;I)V",at=@At("HEAD"),require=1)
 private void xrn$scale(LivingEntity entity,ItemStack stack,ItemDisplayContext mode,MatrixStack matrices,OrderedRenderCommandQueue queue,int light,CallbackInfo ci){float scale=TailleObjets.facteur(stack,false);matrices.push();matrices.scale(scale,scale,scale);}
 @Inject(method="renderItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/item/ItemStack;Lnet/minecraft/item/ItemDisplayContext;Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;I)V",at=@At("RETURN"),require=1)
 private void xrn$restore(LivingEntity entity,ItemStack stack,ItemDisplayContext mode,MatrixStack matrices,OrderedRenderCommandQueue queue,int light,CallbackInfo ci){matrices.pop();}
}
