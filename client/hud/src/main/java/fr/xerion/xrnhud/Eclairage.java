package fr.xerion.xrnhud;
/** Render-only fullbright, with no world or status-effect mutation. */
public final class Eclairage {private Eclairage(){}public static boolean actif(){var c=net.minecraft.client.MinecraftClient.getInstance();return Fonctions.fullbright&&c.world!=null&&c.player!=null;}}
