package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.invoke.arg.Args;
@Mixin(net.minecraft.client.renderer.entity.EntityRenderer.class)
public abstract class NameTagLightMixin {
 @ModifyArgs(method="submitNameDisplay(Lnet/minecraft/client/renderer/entity/state/EntityRenderState;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;Lnet/minecraft/client/renderer/state/level/CameraRenderState;I)V",at=@At(value="INVOKE",target="Lnet/minecraft/client/renderer/SubmitNodeCollector;submitNameTag(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/world/phys/Vec3;ILnet/minecraft/network/chat/Component;ZILnet/minecraft/client/renderer/state/level/CameraRenderState;)V"),require=1)
 private void xrn$emissiveLabel(Args args){if(!fr.xerion.xrnhud.NameTag.lueur)return;net.minecraft.network.chat.Component name=args.get(3);if(name==null)return;String flat=name.getString(),local=net.minecraft.client.Minecraft.getInstance().getGameProfile().name();if(flat.contains(fr.xerion.xrnhud.Logo.CARACTERE)||fr.xerion.xrnhud.NameTag.actif&&flat.contains(local))args.set(5,15728880);}
}
