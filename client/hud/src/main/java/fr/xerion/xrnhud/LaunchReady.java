package fr.xerion.xrnhud;
/** Sent once after startup loading has finished and a game screen is present. */
final class LaunchReady {
 private static boolean sent;private static int frames;
 static void tick(){if(sent)return;String id=System.getProperty("XRNLaunchId","");if(id.isEmpty())return;var c=net.minecraft.client.MinecraftClient.getInstance();
 if(c.getOverlay()!=null||(c.currentScreen==null&&c.world==null)){frames=0;return;}if(++frames<3)return;sent=true;System.out.println("XRN_CLIENT_READY "+id);}
}
