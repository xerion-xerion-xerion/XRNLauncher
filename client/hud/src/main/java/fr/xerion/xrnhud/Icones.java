package fr.xerion.xrnhud;
import net.minecraft.client.gui.DrawContext;
/** Original pictograms on an 24-unit grid, one symbol per module. */
final class Icones {
 private static void line(DrawContext c,int x,int y,int a,int b,int d,int e,int color){
  int dx=Math.abs(d-a),sx=a<d?1:-1,dy=-Math.abs(e-b),sy=b<e?1:-1,error=dx+dy;
  while(true){Theme.rect(c,x+a,y+b,1,1,color);if(a==d&&b==e)break;int next=2*error;if(next>=dy){error+=dy;a+=sx;}if(next<=dx){error+=dx;b+=sy;}}
 }
 private static void path(DrawContext c,int x,int y,int color,int...p){for(int i=0;i+3<p.length;i+=2)line(c,x,y,p[i],p[i+1],p[i+2],p[i+3],color);}
 static void draw(DrawContext c,String name,int x,int y,int color){
  int tint=Theme.alpha(color,.16);Theme.arrondi(c,x-5,y-4,34,32,tint,0);
  var item=switch(name){case "Totem Count"->net.minecraft.item.Items.TOTEM_OF_UNDYING;case "Armure"->net.minecraft.item.Items.DIAMOND_CHESTPLATE;case "Effets"->net.minecraft.item.Items.POTION;case "Nether"->net.minecraft.item.Items.OBSIDIAN;case "Durabilite"->net.minecraft.item.Items.DIAMOND_PICKAXE;default->null;};
  if(item!=null){c.getMatrices().pushMatrix();c.getMatrices().translate(x,y);c.getMatrices().scale(1.5f,1.5f);c.drawItem(item.getDefaultStack(),0,0);c.getMatrices().popMatrix();return;}
  switch(name){
   case "Fullbright"->{Theme.arrondi(c,x+7,y+7,11,11,color,0);for(int n=0;n<8;n++){double a=n*Math.PI/4;int rx=12+(int)Math.round(Math.cos(a)*10),ry=12+(int)Math.round(Math.sin(a)*10);line(c,x,y,rx,ry,12+(int)Math.round(Math.cos(a)*13),12+(int)Math.round(Math.sin(a)*13),color);}}

   case "Motion Blur"->{Theme.cadre(c,x+10,y+3,13,18,0,color);Theme.cadre(c,x+6,y+5,10,14,0,color);line(c,x,y,0,8,4,8,color);line(c,x,y,0,12,4,12,color);line(c,x,y,0,16,4,16,color);}
   case "Free Look"->{Theme.arrondi(c,x+2,y+6,21,13,0,color);Theme.cadre(c,x+9,y+9,7,7,0,color);line(c,x,y,5,2,19,2,color);line(c,x,y,19,2,22,5,color);}
   case "Auto Text"->{Theme.arrondi(c,x+1,y+3,22,15,0,color);path(c,x,y,color,5,17,5,22,11,17);for(int i=0;i<3;i++)Theme.rect(c,x+5+i*5,y+9,2,2,color);}
   case "Auto Connect"->{Theme.cadre(c,x+2,y+3,13,17,0,color);path(c,x,y,color,10,11,23,11,19,7,23,11,19,15);}
   case "Armure"->{path(c,x,y,color,5,2,1,6,4,12,7,10,7,22,18,22,18,10,21,12,24,6,19,2,16,5,9,5,5,2);}
   case "Totem Count"->{
    // A stepped silhouette, emerald eyes and raised arms, like the actual item.
    path(c,x,y,color,9,1,16,1,18,4,18,8,21,6,24,7,23,12,18,16,17,22,14,24,10,24,7,22,6,16,1,12,0,7,3,6,7,9,7,4,9,1);
    Theme.rect(c,x+9,y+4,3,3,0xFF7DD7A2);Theme.rect(c,x+14,y+4,3,3,0xFF7DD7A2);
    Theme.rect(c,x+10,y+10,6,7,Theme.alpha(color,.65));Theme.rect(c,x+8,y+19,3,3,color);Theme.rect(c,x+14,y+19,3,3,color);
   }
   case "FPS Plus"->{path(c,x,y,color,13,1,4,14,12,14,10,24,22,9,14,9,13,1);}

   case "Hitboxes"->{path(c,x,y,color,2,7,12,2,22,7,22,18,12,23,2,18,2,7,12,12,22,7);line(c,x,y,12,12,12,23,color);}
   case "Contours blocs"->{Theme.cadre(c,x+3,y+3,18,18,0,color);Theme.cadre(c,x+7,y+7,10,10,0,Theme.alpha(color,.35));}
   case "Balises"->{path(c,x,y,color,12,23,4,12,4,5,9,1,15,1,20,5,20,12,12,23);Theme.cadre(c,x+9,y+6,7,7,0,color);}
   case "Ping"->{for(int i=0;i<4;i++)Theme.rect(c,x+2+i*6,y+21-i*5,3,3+i*5,color);}
   case "Touches"->{for(int i=0;i<3;i++)Theme.cadre(c,x+i*8,y+14,7,7,0,color);Theme.cadre(c,x+8,y+6,7,7,0,color);}
   case "Inventory HUD"->{Theme.cadre(c,x+1,y+3,23,18,0,color);for(int i=0;i<3;i++)for(int j=0;j<3;j++)Theme.cadre(c,x+4+i*7,y+6+j*4,4,3,0,color);}
   case "Inventaire"->{path(c,x,y,color,5,8,5,4,18,4,18,8);Theme.arrondi(c,x+2,y+8,20,14,0,color);line(c,x,y,2,13,22,13,color);}
   case "Scoreboard"->{Theme.cadre(c,x+1,y+2,22,21,0,color);for(int i=0;i<3;i++){line(c,x,y,5,8+i*5,14,8+i*5,color);Theme.rect(c,x+18,y+7+i*5,2,2,color);}}
   case "Player List"->{for(int i=0;i<3;i++){Theme.cadre(c,x+1,y+2+i*8,5,5,0,color);line(c,x,y,9,4+i*8,23,4+i*8,color);}}
   case "Memoire"->{Theme.cadre(c,x+5,y+5,15,15,0,color);for(int i=0;i<4;i++){line(c,x,y,7+i*3,1,7+i*3,4,color);line(c,x,y,7+i*3,21,7+i*3,24,color);line(c,x,y,1,7+i*3,4,7+i*3,color);line(c,x,y,21,7+i*3,24,7+i*3,color);}}
   case "Musique"->{path(c,x,y,color,7,19,7,4,21,1,21,17);Theme.arrondi(c,x+1,y+17,7,5,color,0);Theme.arrondi(c,x+15,y+15,7,5,color,0);}
   case "Clics"->{Theme.arrondi(c,x+6,y+1,13,22,0,color);line(c,x,y,12,2,12,10,color);line(c,x,y,6,11,19,11,color);Theme.rect(c,x+8,y+4,2,4,color);}
   case "Effets"->{path(c,x,y,color,8,1,16,1,16,5,14,5,14,10,21,20,18,23,5,23,2,20,10,10,10,5,8,5,8,1);line(c,x,y,6,17,18,17,color);}
   case "Vitesse"->{path(c,x,y,color,13,1,4,14,12,14,10,24,22,9,14,9,13,1);}
   case "Nether"->{Theme.cadre(c,x+4,y+1,16,23,0,color);Theme.cadre(c,x+7,y+4,10,17,0,color);path(c,x,y,color,10,19,15,10,10,13,14,5);}
   case "Shader Monitor"->{Theme.cadre(c,x+1,y+2,23,16,0,color);line(c,x,y,12,19,12,23,color);line(c,x,y,7,23,18,23,color);path(c,x,y,color,6,13,10,7,15,13,20,6);}
   case "Informations"->{Theme.cadre(c,x+1,y+2,22,21,0,color);line(c,x,y,6,8,18,8,color);line(c,x,y,6,13,16,13,color);line(c,x,y,6,18,13,18,color);}
   case "Day Counter"->{Theme.cadre(c,x+2,y+4,21,19,0,color);line(c,x,y,2,10,23,10,color);line(c,x,y,7,1,7,7,color);line(c,x,y,18,1,18,7,color);Theme.cadre(c,x+7,y+14,4,4,0,color);}
   case "Durabilite"->{path(c,x,y,color,3,20,19,4,19,1,23,1,23,5,20,5);line(c,x,y,6,14,11,19,color);line(c,x,y,1,18,7,24,color);}
   case "Session"->{Theme.cadre(c,x+4,y+1,17,3,0,color);Theme.cadre(c,x+4,y+21,17,3,0,color);path(c,x,y,color,5,4,19,20,19,22,5,22,5,20,19,4);}
   case "Rappel de pause"->{Theme.arrondi(c,x+3,y+5,15,17,0,color);path(c,x,y,color,18,8,23,8,23,16,18,16);line(c,x,y,6,1,6,3,color);line(c,x,y,13,1,13,3,color);}
   case "Name Tag"->{Theme.arrondi(c,x,y+3,24,18,0,color);Theme.cadre(c,x+3,y+7,6,8,0,color);for(int n=0;n<4;n++)Theme.rect(c,x+11+n*3,y+8,2,8,Theme.melange(NameTag.debut,NameTag.fin,n/3f));}
   case "Taille des objets"->{path(c,x,y,color,4,20,20,4,20,1,23,1,23,4,7,20,4,20);path(c,x,y,color,2,9,2,2,9,2);path(c,x,y,color,15,23,23,23,23,15);}
   case "Ciel XRN"->{Theme.arrondi(c,x+2,y+11,22,10,0,color);path(c,x,y,color,6,11,6,7,10,4,15,4,19,8,19,11);path(c,x,y,color,3,1,3,7,0,4,6,4);}
   default->{Theme.marque(c,x+4,y+4,2);}
  }
 }
}
