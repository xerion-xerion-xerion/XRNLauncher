package fr.xerion.xrnhud;

import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.world.item.Items;

/** Optional small overlays. Values are sampled at most twice per second. */
final class ModulesPlus {
    static boolean totems,jours,latence,joueurs,shaders,sac;
    private static int ticks,nbTotems;
    private static String shader="Aucun shader";
    static final Placement.Element SAC=new Placement.Element("sac");
    static final Placement.Element TOTEMS=new Placement.Element("totems"),JOURS=new Placement.Element("jours"),PING=new Placement.Element("ping"),JOUEURS=new Placement.Element("joueurs"),SHADERS=new Placement.Element("shaders");
    static void tick(Minecraft cl){
        if(cl.player==null||++ticks%10!=0)return;
        nbTotems=0;
        if(totems){for(int i=0;i<36;i++){var stack=cl.player.getInventory().getItem(i);if(stack.is(Items.TOTEM_OF_UNDYING))nbTotems+=stack.getCount();}var off=cl.player.getOffhandItem();if(off.is(Items.TOTEM_OF_UNDYING))nbTotems+=off.getCount();}
        if(shaders&&ticks%20==0){
            shader="Aucun shader";
            if(net.fabricmc.loader.api.FabricLoader.getInstance().isModLoaded("iris")){
                try{Class<?> api=Class.forName("net.irisshaders.iris.api.v0.IrisApi");Object instance=api.getMethod("getInstance").invoke(null);shader=(boolean)api.getMethod("isShaderPackInUse").invoke(instance)?"Shaders actifs · Iris":"Shaders inactifs · Iris";}catch(ReflectiveOperationException|LinkageError e){shader="Iris · etat indisponible";}
            }
        }
    }
    static void dessiner(GuiGraphicsExtractor c,Minecraft cl,float alpha){
        if(sac)inventaire(c,cl,alpha);
        if(totems)ligne(c,cl,TOTEMS,"Totems  "+nbTotems,6,160,alpha);
        if(jours&&cl.level!=null)ligne(c,cl,JOURS,"Jour  "+(cl.level.getOverworldClockTime()/24000L+1),6,174,alpha);
        if(latence&&cl.getConnection()!=null&&cl.player!=null){var entry=cl.getConnection().getPlayerInfo(cl.player.getUUID());ligne(c,cl,PING,"Ping  "+(cl.isLocalServer()?"Local":entry==null?"—":entry.getLatency()+" ms"),6,188,alpha);}
        if(shaders)ligne(c,cl,SHADERS,shader,6,202,alpha);
        if(joueurs&&cl.getConnection()!=null){
            List<String> names=new ArrayList<>();var list=cl.getConnection().getOnlinePlayers();names.add("Joueurs  "+list.size());
            list.stream().sorted(java.util.Comparator.comparing(e->e.getProfile().name())).limit(6).forEach(e->names.add(e.getProfile().name()+"  "+e.getLatency()+" ms"));
            bloc(c,cl,JOUEURS,names,cl.getWindow().getGuiScaledWidth()-146,68,alpha);
        }
    }
    private static void inventaire(GuiGraphicsExtractor c,Minecraft cl,float alpha){
        if(SAC.hidden||cl.player==null)return;int w=9*18,h=3*18,dx=cl.getWindow().getGuiScaledWidth()-w-6,dy=cl.getWindow().getGuiScaledHeight()-h-38;
        int x=Cadres.limiterX(dx+SAC.dx,w,SAC),y=Cadres.limiterY(dy+SAC.dy,h,SAC);Cadres.debut(c,SAC,x,y);
        for(int i=0;i<27;i++){int ix=x+i%9*18,iy=y+i/9*18;Theme.rect(c,ix,iy,17,17,Theme.alpha(0x7017141E,alpha));var value=cl.player.getInventory().getItem(i+9);if(value.isEmpty())continue;c.item(value,ix+1,iy+1);if(value.getCount()>1){String count=String.valueOf(value.getCount());Theme.texte(c,cl.font,count,ix+17-cl.font.width(count),iy+9,Theme.TEXTE);}}
        Cadres.fin(c);Cadres.placer(SAC.id,dx,dy,x,y,w,h);
    }
    private static void ligne(GuiGraphicsExtractor c,Minecraft cl,Placement.Element e,String value,int x,int y,float a){bloc(c,cl,e,List.of(value),x,y,a);}
    private static void bloc(GuiGraphicsExtractor c,Minecraft cl,Placement.Element e,List<String> values,int dx,int dy,float a){
        if(e.hidden)return;int w=values.stream().mapToInt(cl.font::width).max().orElse(0),h=values.size()*11;
        int x=Cadres.limiterX(dx+e.dx,w,e),y=Cadres.limiterY(dy+e.dy,h,e);
        Cadres.debut(c,e,x,y);for(int i=0;i<values.size();i++)Theme.texte(c,cl.font,values.get(i),x,y+i*11,Theme.alpha(Theme.TEXTE,a));Cadres.fin(c);Cadres.placer(e.id,dx,dy,x,y,w,h);
    }
    static void charger(JsonObject o){if(o.has("inventoryHud"))sac=o.get("inventoryHud").getAsBoolean();if(o.has("totems"))totems=o.get("totems").getAsBoolean();if(o.has("jours"))jours=o.get("jours").getAsBoolean();if(o.has("pingSepare"))latence=o.get("pingSepare").getAsBoolean();if(o.has("listeJoueurs"))joueurs=o.get("listeJoueurs").getAsBoolean();if(o.has("shaderMonitor"))shaders=o.get("shaderMonitor").getAsBoolean();}
    static void sauver(JsonObject o){o.addProperty("inventoryHud",sac);o.addProperty("totems",totems);o.addProperty("jours",jours);o.addProperty("pingSepare",latence);o.addProperty("listeJoueurs",joueurs);o.addProperty("shaderMonitor",shaders);}
}
