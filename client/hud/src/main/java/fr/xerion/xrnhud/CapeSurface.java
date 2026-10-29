package fr.xerion.xrnhud;
/** One ring of shared corners at every fold: adjacent faces cannot separate. */
public final class CapeSurface {
 public final float[][] coins=new float[36][3];
 public final float[] angles=new float[9],lateraux=new float[9];
 public void calculer(float age,int id,float mouvement){
  float[][] pose=CapeDynamique.pose(age,id,mouvement,CapeMouvement.intensite);
  float x=0,y=0,z=-.5f,oldP=0,oldS=0;
  for(int row=0;row<=8;row++){
   float p=pose[row][0],s=pose[row][1];angles[row]=p;lateraux[row]=s;
   if(row>0){float pm=(p+oldP)*.5f,sm=(s+oldS)*.5f;x-=2*(float)Math.sin(sm);y+=2*(float)(Math.cos(sm)*Math.cos(pm));z+=2*(float)(Math.cos(sm)*Math.sin(pm));}
   float cp=(float)Math.cos(p),sp=(float)Math.sin(p),cs=(float)Math.cos(s),ss=(float)Math.sin(s);
   for(int corner=0;corner<4;corner++){float width=(corner&1)==0?-5:5,depth=(corner&2)==0?-.5f:.5f;float[] v=coins[row*4+corner];v[0]=x+width*cs;v[1]=y+width*ss*cp-depth*sp;v[2]=z+width*ss*sp+depth*cp;}
   oldP=p;oldS=s;
  }
 }
 public float[] coin(float x,float y,float z){return coins[Math.clamp(Math.round(y*.5f),0,8)*4+(x>0?1:0)+(z>-.5f?2:0)];}
}
