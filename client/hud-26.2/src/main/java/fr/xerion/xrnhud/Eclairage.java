package fr.xerion.xrnhud;
/** Render-only fullbright, with no world or status-effect mutation. */
public final class Eclairage {private Eclairage(){}public static boolean actif(){var c=net.minecraft.client.Minecraft.getInstance();return Fonctions.fullbright&&c.level!=null&&c.player!=null;}}
