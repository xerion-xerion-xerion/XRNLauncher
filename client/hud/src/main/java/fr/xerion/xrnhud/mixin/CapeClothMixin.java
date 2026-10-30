package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.*;import java.util.*;import net.minecraft.client.model.*;import net.minecraft.client.render.entity.model.PlayerCapeModel;import net.minecraft.client.render.entity.state.PlayerEntityRenderState;import net.minecraft.util.math.Direction;import org.joml.Vector3f;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
/** Shared seam corners keep the cloth closed. Vanilla remains responsible for placement and skin rights. */
@Mixin(PlayerCapeModel.class)
public abstract class CapeClothMixin {
 @Shadow @Final private ModelPart cape;
 @Unique private float xrn$age=Float.NaN,xrn$motion,xrn$strength;@Unique private int xrn$id;
 @Unique private ModelPart xrn$cloth;@Unique private List<ModelPart.Cuboid> xrn$cubes;
 @Unique private ModelPart.Quad[][] xrn$rest;@Unique private CapeSurface xrn$surface;
 @Inject(method="getTexturedModelData",at=@At("RETURN"),require=1)
 private static void xrn$layer(CallbackInfoReturnable<TexturedModelData> ci){
  var data=((CapeLayerDataAccessor)(Object)ci.getReturnValue()).xrn$data();var parent=data.getRoot().getChild("body").getChild("cape");ModelPartBuilder builder=ModelPartBuilder.create();
  for(int i=0;i<8;i++){Set<Direction> faces=EnumSet.of(Direction.NORTH,Direction.SOUTH,Direction.EAST,Direction.WEST);if(i==0)faces.add(Direction.DOWN);if(i==7)faces.add(Direction.UP);builder.uv(0,i*2).cuboid(-5,i*2,-1,10,2,1,faces);}
  parent.addChild("xrn_cloth",builder,ModelTransform.NONE);
 }
 @Inject(method="<init>",at=@At("TAIL"),require=1)
 private void xrn$creer(ModelPart root,CallbackInfo ci){
  xrn$cloth=cape.getChild("xrn_cloth");xrn$cubes=((CapePartsAccessor)(Object)xrn$cloth).xrn$cubes();xrn$rest=new ModelPart.Quad[xrn$cubes.size()][];
  for(int i=0;i<xrn$cubes.size();i++){var cube=xrn$cubes.get(i);for(int q=0;q<cube.sides.length;q++){var face=cube.sides[q];ModelPart.Vertex[] v=new ModelPart.Vertex[4];for(int k=0;k<4;k++){var old=face.vertices()[k];v[k]=new ModelPart.Vertex(old.x(),old.y(),old.z(),old.u(),old.v()*2);}cube.sides[q]=new ModelPart.Quad(v,new Vector3f(face.direction()));}xrn$rest[i]=cube.sides.clone();}
  xrn$surface=new CapeSurface();xrn$cloth.visible=false;
 }
 @Inject(method="setAngles(Lnet/minecraft/client/render/entity/state/PlayerEntityRenderState;)V",at=@At("TAIL"),require=1)
 private void xrn$animer(PlayerEntityRenderState state,CallbackInfo ci){
  boolean ours=state.skinTextures!=null&&state.skinTextures.cape()!=null&&"xrnhud".equals(state.skinTextures.cape().texturePath().getNamespace());
  boolean active=ours&&CapeMouvement.actif&&!CapeMouvement.externe()&&!((CapeApercu)(Object)state).xrn$apercuCape();cape.hidden=active;xrn$cloth.visible=active;if(!active)return;
  float motion=Math.max(state.limbSwingAmplitude,Math.abs(state.field_53537)/90);
  if(xrn$age==state.age&&xrn$id==state.id&&xrn$motion==motion&&xrn$strength==CapeMouvement.intensite)return;
  xrn$age=state.age;xrn$id=state.id;xrn$motion=motion;xrn$strength=CapeMouvement.intensite;xrn$surface.calculer(state.age,state.id,motion);
  for(int i=0;i<xrn$cubes.size();i++){
   float p=(xrn$surface.angles[i]+xrn$surface.angles[i+1])*.5f,s=(xrn$surface.lateraux[i]+xrn$surface.lateraux[i+1])*.5f;
   for(int q=0;q<xrn$rest[i].length;q++){
    ModelPart.Quad rest=xrn$rest[i][q];ModelPart.Vertex[] vertices=new ModelPart.Vertex[4];
    for(int k=0;k<4;k++){ModelPart.Vertex v=rest.vertices()[k];float[] point=xrn$surface.coin(v.x(),v.y(),v.z());vertices[k]=new ModelPart.Vertex(point[0],point[1],point[2],v.u(),v.v());}
    xrn$cubes.get(i).sides[q]=new ModelPart.Quad(vertices,new Vector3f(rest.direction()).rotateZ(s).rotateX(p));
   }
  }
 }
}
