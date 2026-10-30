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
  var flat=((CapePartsAccessor)(Object)cape).xrn$cubes().getFirst().sides;
  for(int i=0;i<xrn$cubes.size();i++){var cube=xrn$cubes.get(i);for(int q=0;q<cube.sides.length;q++){var side=cube.sides[q];ModelPart.Quad reference=null;for(var candidate:flat)if(candidate.direction().dot(side.direction())>.99f){reference=candidate;break;}if(reference==null)throw new IllegalStateException("Missing cape UV face");var a=reference.vertices()[0];var b=reference.vertices()[1];var d=reference.vertices()[3];var ab=new Vector3f(b.x()-a.x(),b.y()-a.y(),b.z()-a.z());var ad=new Vector3f(d.x()-a.x(),d.y()-a.y(),d.z()-a.z());ModelPart.Vertex[] vertices=new ModelPart.Vertex[4];for(int k=0;k<4;k++){var old=side.vertices()[k];var ap=new Vector3f(old.x()-a.x(),old.y()-a.y(),old.z()-a.z());float u=ap.dot(ab)/ab.lengthSquared(),v=ap.dot(ad)/ad.lengthSquared();vertices[k]=new ModelPart.Vertex(old.x(),old.y(),old.z(),a.u()+u*(b.u()-a.u())+v*(d.u()-a.u()),a.v()+u*(b.v()-a.v())+v*(d.v()-a.v()));}cube.sides[q]=new ModelPart.Quad(vertices,new Vector3f(side.direction()));}xrn$rest[i]=cube.sides.clone();}
  xrn$surface=new CapeSurface();xrn$cloth.visible=false;
 }
 @Inject(method="setAngles(Lnet/minecraft/client/render/entity/state/PlayerEntityRenderState;)V",at=@At("TAIL"),require=1)
 private void xrn$animer(PlayerEntityRenderState state,CallbackInfo ci){
  boolean ours=state.skinTextures!=null&&state.skinTextures.cape()!=null&&"xrnhud".equals(state.skinTextures.cape().texturePath().getNamespace());
  boolean active=ours&&CapeMouvement.actif&&!CapeMouvement.externe()&&!((CapeApercu)(Object)state).xrn$apercuCape();cape.hidden=active;xrn$cloth.visible=active;if(!active)return;
  float motion=Math.max(state.limbSwingAmplitude,Math.abs(state.field_53537)/90);
  float clothAge=(float)Math.floor(state.age*3f)/3f;motion=Math.round(motion*20f)/20f;
  if(xrn$age==clothAge&&xrn$id==state.id&&xrn$motion==motion&&xrn$strength==CapeMouvement.intensite)return;
  xrn$age=clothAge;xrn$id=state.id;xrn$motion=motion;xrn$strength=CapeMouvement.intensite;xrn$surface.calculer(clothAge,state.id,motion);
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
