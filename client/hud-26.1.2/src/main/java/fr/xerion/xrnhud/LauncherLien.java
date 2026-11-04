package fr.xerion.xrnhud;
import java.nio.file.*;import com.google.gson.JsonObject;
final class LauncherLien {
 static void ouvrir(String view){if(!view.equals("store")&&!view.equals("account"))return;try{var c=net.minecraft.client.Minecraft.getInstance();var o=new JsonObject();o.addProperty("id",java.util.UUID.randomUUID().toString());o.addProperty("uuid",c.getGameProfile().id().toString().replace("-",""));o.addProperty("at",System.currentTimeMillis());o.addProperty("action",view);Path dir=net.fabricmc.loader.api.FabricLoader.getInstance().getGameDir().resolve(".xrn-menu");Files.createDirectories(dir);Path tmp=dir.resolve("request.tmp");Files.writeString(tmp,o.toString());Files.move(tmp,dir.resolve("request.json"),StandardCopyOption.REPLACE_EXISTING);}catch(Exception ignored){}}
}
