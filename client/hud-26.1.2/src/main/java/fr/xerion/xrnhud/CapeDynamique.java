package fr.xerion.xrnhud;
import java.util.LinkedHashMap;
/** Original XRN angular cloth: damped springs, propagated movement and a fixed shoulder edge. */
public final class CapeDynamique {
 private static final class Etat {float age=Float.NaN,motion;final float[] bend=new float[9],side=new float[9],bv=new float[9],sv=new float[9];final float[][] result=new float[9][2];}
 private static final LinkedHashMap<Integer,Etat> etats=new LinkedHashMap<>(64,.75f,true);
 private CapeDynamique(){}
 public static float[][] pose(float age,int id,float mouvement,float force){
  if(!Float.isFinite(age))age=0;float motion=Float.isFinite(mouvement)?Math.clamp(mouvement,0,1.5f):0;force=Float.isFinite(force)?Math.clamp(force,.4f,1.6f):1;
  Etat e=etats.computeIfAbsent(id,k->new Etat());while(etats.size()>256)etats.remove(etats.keySet().iterator().next());
  float elapsed=Float.isNaN(e.age)?0:(age-e.age)/20;
  if(Float.isNaN(e.age)||elapsed<0||elapsed>1){for(int i=0;i<9;i++){float d=i/8f;e.bend[i]=(.015f+.35f*motion)*d*force;e.side[i]=e.bv[i]=e.sv[i]=0;}e.age=age;e.motion=motion;elapsed=0;}
  if(elapsed>0){float dt=Math.min(.1f,elapsed),kick=Math.clamp((motion-e.motion)/Math.max(.001f,elapsed),-3,3);int steps=Math.max(1,(int)Math.ceil(dt*120));float h=dt/steps;
   for(int step=0;step<steps;step++)for(int i=1;i<=8;i++){
    float d=i/8f,wind=(float)Math.sin(age*.055f-id*.31f-d*2.3f),bendTarget=force*d*(.018f+.55f*motion+.12f*Math.max(0,kick)+.055f*wind*(.12f+motion)),sideTarget=force*d*.045f*(float)Math.sin(age*.037f+id*.23f-d*1.7f)*(.08f+motion);
    float stiffness=36-10*d,follow=.17f;e.bv[i]+=((bendTarget-e.bend[i])*stiffness+(e.bend[i-1]-e.bend[i])*(stiffness*follow)-e.bv[i]*7.5f)*h;e.sv[i]+=((sideTarget-e.side[i])*stiffness+(e.side[i-1]-e.side[i])*(stiffness*follow)-e.sv[i]*8)*h;
    e.bend[i]=Math.clamp(e.bend[i]+e.bv[i]*h,0,1.2f);e.side[i]=Math.clamp(e.side[i]+e.sv[i]*h,-.22f,.22f);
   }e.age=age;e.motion=motion;
  }
  for(int i=0;i<=8;i++){e.result[i][0]=e.bend[i];e.result[i][1]=e.side[i];}return e.result;
 }
}
