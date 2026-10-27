package fr.xerion.xrnhud.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.TitleScreen;

/**
 * La signature du client, en bas a gauche du menu principal.
 *
 * <p>Le jeu y ecrit sa version et le nombre de mods, en blanc. On y
 * ajoute la notre, en violet : on voit d un coup d oeil que le jeu
 * tourne sous XRN Client, et avec quelle version.
 */
@Mixin(TitleScreen.class)
public class TitleScreenMixin {

    @org.spongepowered.asm.mixin.Shadow private net.minecraft.client.gui.screen.SplashTextRenderer splashText;
    @Inject(method="init",at=@At("TAIL"))
    private void xrn$splash(CallbackInfo ci){splashText=new net.minecraft.client.gui.screen.SplashTextRenderer(net.minecraft.text.Text.literal("Also watch Interstellar"));}

    @Inject(method = "render", at = @At("TAIL"))
    private void xrn$signature(DrawContext context, int mouseX, int mouseY,
                                float delta, CallbackInfo ci) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.textRenderer == null) return;

        /*  La version affichee est celle du LAUNCHER, pas celle du mod :
            les deux ne se numerotent pas pareil. Le launcher la passe
            en propriete systeme au lancement du jeu.                  */
        String version = "XRNClient";
        try {
            String versionLauncher = System.getProperty("XRNLauncherVersion", "");
            if (versionLauncher != null && !versionLauncher.isEmpty()) {
                version = version + " v" + versionLauncher;
            } else {
                version = version + " " + FabricLoader.getInstance()
                        .getModContainer("xrnhud")
                        .map(m -> m.getMetadata().getVersion().getFriendlyString())
                        .orElse("?");
            }
        } catch (Throwable e) {
            /*  Version inconnue : on garde le nom seul. */
        }

        int y = client.getWindow().getScaledHeight() - 20;
        context.drawTextWithShadow(client.textRenderer, version, 2, y, 0xFFA78BFA);
    }
}
