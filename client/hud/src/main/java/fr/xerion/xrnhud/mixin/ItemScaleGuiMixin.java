package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import fr.xerion.xrnhud.TailleObjets;
import net.minecraft.entity.LivingEntity;
import net.minecraft.world.World;
import net.minecraft.item.ItemStack;
@Mixin(net.minecraft.client.gui.DrawContext.class)
public abstract class ItemScaleGuiMixin {
 @Shadow public abstract org.joml.Matrix3x2fStack getMatrices();
 @Inject(method="drawItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/world/World;Lnet/minecraft/item/ItemStack;III)V",at=@At("HEAD"),require=1)
 private void xrn$scale(LivingEntity entity,World level,ItemStack stack,int x,int y,int seed,CallbackInfo ci){float scale=TailleObjets.facteur(stack,true);var m=getMatrices();m.pushMatrix();m.translate(x+8,y+8);m.scale(scale,scale);m.translate(-x-8,-y-8);}
 @Inject(method="drawItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/world/World;Lnet/minecraft/item/ItemStack;III)V",at=@At("RETURN"),require=1)
 private void xrn$restore(LivingEntity entity,World level,ItemStack stack,int x,int y,int seed,CallbackInfo ci){getMatrices().popMatrix();}
}
