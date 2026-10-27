package fr.xerion.xrnhud;
public final class StyleMenus {
    public static boolean actif(){
        var cl=net.minecraft.client.MinecraftClient.getInstance();
        var screen=cl.currentScreen;
        return screen!=null && (screen.getClass().getPackageName().equals("fr.xerion.xrnhud") || (!AccueilEcran.classique && cl.world==null));
    }
    public static void fond(net.minecraft.client.gui.DrawContext c,int x,int y,int w,int h,boolean hover,boolean active){
        Theme.arrondi(c,x,y,w,h,!active?0xCC211E28:hover?0xEF4B3B62:0xE82A2435,!active?0xFF403A49:hover?Theme.ACCENT:0xFF655477);
    }
}
