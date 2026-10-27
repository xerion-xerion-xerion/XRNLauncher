package fr.xerion.xrnhud;

import com.google.gson.JsonObject;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import org.lwjgl.glfw.GLFW;

final class Raccourcis {
    static final KeyMapping.Category CATEGORY=KeyMapping.Category.register(net.minecraft.resources.Identifier.fromNamespaceAndPath("xrnhud","controls"));
    static boolean autoText,autoConnect;
    static String message="gg",messageMort="gg",adresse="";
    static boolean surKill=true,surMort=true;
    private static boolean etaitMort;private static String automatique="";private static long dernierEvenement;
    private static KeyMapping textKey,pointKey;
    private static long lastText;
    private static boolean startupHandled;
    static void installer(){
        net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents.GAME.register((value,overlay)->{if(!overlay)recevoir(Minecraft.getInstance(),value);});
        textKey=KeyMappingHelper.registerKeyMapping(new KeyMapping("key.xrnhud.autotext",InputConstants.Type.KEYSYM,GLFW.GLFW_KEY_UNKNOWN,CATEGORY));
        pointKey=KeyMappingHelper.registerKeyMapping(new KeyMapping("key.xrnhud.waypoints",InputConstants.Type.KEYSYM,GLFW.GLFW_KEY_B,CATEGORY));
    }
    static void recevoir(Minecraft cl,net.minecraft.network.chat.Component value){
        if(!autoText||cl.player==null)return;
        String moi=cl.player.getName().getString();
        if(value.getContents() instanceof net.minecraft.network.chat.contents.TranslatableContents t&&t.getKey().startsWith("death.")){
            Object[] args=t.getArgs();
            if(args.length>1&&args[1] instanceof net.minecraft.network.chat.Component killer&&killer.getString().equals(moi))evenement(true);
            if(args.length>0&&args[0] instanceof net.minecraft.network.chat.Component victim&&victim.getString().equals(moi))evenement(false);
        }else{
            int event=detecter(value.getString(),moi);
            if(event!=0)evenement(event>0);
        }
    }
    // System announcements only: ordinary player chat must not trigger messages.
    static int detecter(String value,String name){
        String line=java.text.Normalizer.normalize(value.replaceAll("§.",""),java.text.Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(java.util.Locale.ROOT).strip();
        String me=java.util.regex.Pattern.quote(name.toLowerCase(java.util.Locale.ROOT));
        String prefix="^(?:\\[[^]\\r\\n]{0,32}\\]\\s*)*";
        if(line.matches(prefix+"(?:you (?:killed|eliminated|defeated)|vous avez (?:tue|elimine)|tu as (?:tue|elimine))\\b.*"))return 1;
        if(line.matches(prefix+"(?:you (?:died|were (?:killed|slain|eliminated))|vous (?:etes mort|avez ete tue)|tu (?:es mort|as ete tue))\\b.*"))return -1;
        if(line.matches(prefix+"(?:.*? (?:was (?:slain|killed|shot|eliminated|defeated) by|a ete (?:tue|elimine) par) )"+me+"(?:[^a-z0-9_].*)?"))return 1;
        if(line.matches(prefix+me+" (?:was (?:slain|killed|shot|eliminated)|died|a ete (?:tue|elimine)|est mort)\\b.*"))return -1;
        if(line.matches(prefix+me+" (?:killed|eliminated|defeated|a (?:tue|elimine))\\b.*"))return 1;
        if(line.matches(prefix+"(?:winner|gagnant)\\s*[:»>-]\\s*"+me+"(?:[^a-z0-9_].*)?"))return 1;
        return 0;
    }

    static void evenement(boolean kill){
        if(!autoText||(kill?!surKill:!surMort))return;
        long now=System.nanoTime();if(now-dernierEvenement<1_500_000_000L)return;dernierEvenement=now;
        automatique=nettoyer(kill?message:messageMort,256);
    }
    static String touche(){return textKey==null?"Non assignee":textKey.getTranslatedKeyMessage().getString();}
    static void tick(Minecraft cl){
        if(!autoText)automatique="";
        if(cl.player!=null){boolean dead=cl.player.isDeadOrDying();if(dead&&!etaitMort)evenement(false);etaitMort=dead;}else{etaitMort=false;automatique="";}
        if(!automatique.isBlank()&&autoText&&cl.player!=null&&cl.getConnection()!=null&&System.nanoTime()-lastText>=2_000_000_000L){
            String value=automatique;automatique="";lastText=System.nanoTime();
            if(value.startsWith("/")){if(value.length()>1)cl.getConnection().sendCommand(value.substring(1));}else cl.getConnection().sendChat(value);
        }
        while(pointKey.consumeClick())if(cl.player!=null&&cl.gui.screen()==null)cl.gui.setScreen(new BalisesEcran(null));
        while(textKey.consumeClick()){
            if(!autoText||cl.player==null||cl.gui.screen()!=null||cl.getConnection()==null)continue;
            long now=System.nanoTime();if(now-lastText<2_000_000_000L)continue;
            String value=nettoyer(message,256);if(value.isBlank())continue;lastText=now;
            if(value.startsWith("/")){if(value.length()>1)cl.getConnection().sendCommand(value.substring(1));}else cl.getConnection().sendChat(value);
        }
        if(!startupHandled&&(cl.gui.screen() instanceof AccueilEcran||cl.gui.screen() instanceof net.minecraft.client.gui.screens.TitleScreen)){
            startupHandled=true;
            if(autoConnect&&adresseValide(adresse)){
                var parent=cl.gui.screen();
                ConnectScreen.startConnecting(parent,cl,ServerAddress.parseString(adresse),new ServerData("Serveur XRN",adresse,ServerData.Type.OTHER),false,null);
            }
        }
    }
    static String nettoyer(String value,int max){String clean=String.valueOf(value).replaceAll("[\\p{Cntrl}§]","").strip();return clean.substring(0,Math.min(max,clean.length()));}
    static boolean adresseValide(String value){return value!=null&&!value.isBlank()&&value.length()<=255&&!value.matches(".*[\\s/\\\\].*");}
    static void charger(JsonObject o){
        if(o.has("surKill"))surKill=o.get("surKill").getAsBoolean();if(o.has("surMort"))surMort=o.get("surMort").getAsBoolean();if(o.has("messageMort"))messageMort=nettoyer(o.get("messageMort").getAsString(),256);
        if(o.has("beamColor"))Balises.couleur=o.get("beamColor").getAsInt();if(o.has("beamHeight"))Balises.hauteur=Math.clamp(o.get("beamHeight").getAsInt(),128,1024);
        if(o.has("autoText"))autoText=o.get("autoText").getAsBoolean();if(o.has("autoConnect"))autoConnect=o.get("autoConnect").getAsBoolean();
        if(o.has("texteRapide"))message=nettoyer(o.get("texteRapide").getAsString(),256);if(o.has("serveurDemarrage"))adresse=nettoyer(o.get("serveurDemarrage").getAsString(),255);
        if(o.has("balises"))Balises.visible=o.get("balises").getAsBoolean();
    }
    static void sauver(JsonObject o){o.addProperty("surKill",surKill);o.addProperty("surMort",surMort);o.addProperty("messageMort",messageMort);o.addProperty("beamColor",Balises.couleur);o.addProperty("beamHeight",Balises.hauteur);o.addProperty("autoText",autoText);o.addProperty("autoConnect",autoConnect);o.addProperty("texteRapide",message);o.addProperty("serveurDemarrage",adresse);o.addProperty("balises",Balises.visible);}
}
