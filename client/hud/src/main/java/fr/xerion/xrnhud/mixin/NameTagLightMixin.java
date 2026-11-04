package fr.xerion.xrnhud.mixin;
import org.spongepowered.asm.mixin.Mixin;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.invoke.arg.Args;
@Mixin(net.minecraft.client.render.entity.EntityRenderer.class)
public abstract class NameTagLightMixin {
 @ModifyArgs(method="renderLabelIfPresent",at=@At(value="INVOKE",target="Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;submitLabel(Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/util/math/Vec3d;ILnet/minecraft/text/Text;ZIDLnet/minecraft/client/render/state/CameraRenderState;)V"),require=1)
 private void xrn$emissiveLabel(Args args){if(!fr.xerion.xrnhud.NameTag.lueur)return;net.minecraft.text.Text name=args.get(3);if(name==null)return;String flat=name.getString(),local=net.minecraft.client.MinecraftClient.getInstance().getGameProfile().name();if(flat.contains(fr.xerion.xrnhud.Logo.CARACTERE)||fr.xerion.xrnhud.NameTag.actif&&flat.contains(local))args.set(5,15728880);}
}
