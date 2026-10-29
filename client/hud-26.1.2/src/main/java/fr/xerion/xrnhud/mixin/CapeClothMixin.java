package fr.xerion.xrnhud.mixin;
import fr.xerion.xrnhud.*;import java.util.*;import net.minecraft.client.model.geom.*;import net.minecraft.client.model.geom.builders.*;import net.minecraft.client.model.player.PlayerCapeModel;import net.minecraft.client.renderer.entity.state.AvatarRenderState;import net.minecraft.core.Direction;import org.joml.Vector3f;
import org.spongepowered.asm.mixin.*;import org.spongepowered.asm.mixin.injection.*;import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
/** Shared seam corners keep the cloth closed. Vanilla remains responsible for placement and skin rights. */
@Mixin(PlayerCapeModel.class)
public abstract class CapeClothMixin {
 @Shadow @Final private ModelPart cape;
 @Unique private float xrn$age=Float.NaN,xrn$motion,xrn$strength;@Unique private int xrn$id;
 @Unique private ModelPart xrn$cloth;@Unique private List<ModelPart.Cube> xrn$cubes;
 @Unique private ModelPart.Polygon[][] xrn$rest;@Unique private CapeSurface xrn$surface;
 @Inject(method="<init>",at=@At("TAIL"),require=1)
 private void xrn$creer(ModelPart root,CallbackInfo ci){
  MeshDefinition data=new MeshDefinition();CubeListBuilder builder=CubeListBuilder.create();
  for(int i=0;i<8;i++){Set<Direction> faces=EnumSet.of(Direction.NORTH,Direction.SOUTH,Direction.EAST,Direction.WEST);if(i==0)faces.add(Direction.DOWN);if(i==7)faces.add(Direction.UP);builder.texOffs(0,i*2).addBox(-5,i*2,-1,10,2,1,faces);}
  data.getRoot().addOrReplaceChild("cloth",builder,PartPose.ZERO);xrn$cloth=LayerDefinition.create(data,64,32).bakeRoot().getChild("cloth");
  xrn$cubes=((CapePartsAccessor)(Object)xrn$cloth).xrn$cubes();xrn$rest=new ModelPart.Polygon[xrn$cubes.size()][];
  for(int i=0;i<xrn$cubes.size();i++)xrn$rest[i]=xrn$cubes.get(i).polygons.clone();xrn$surface=new CapeSurface();xrn$cloth.visible=false;
  ((CapePartsAccessor)(Object)cape).xrn$children().put("xrn_cloth",xrn$cloth);
 }
 @Inject(method="setupAnim(Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;)V",at=@At("TAIL"),require=1)
 private void xrn$animer(AvatarRenderState state,CallbackInfo ci){
  boolean ours=state.skin!=null&&state.skin.cape()!=null&&"xrnhud".equals(state.skin.cape().texturePath().getNamespace());
  boolean active=ours&&CapeMouvement.actif&&!CapeMouvement.externe()&&!((CapeApercu)(Object)state).xrn$apercuCape();cape.skipDraw=active;xrn$cloth.visible=active;if(!active)return;
  float motion=Math.max(state.walkAnimationSpeed,Math.abs(state.capeLean)/90);
  if(xrn$age==state.ageInTicks&&xrn$id==state.id&&xrn$motion==motion&&xrn$strength==CapeMouvement.intensite)return;
  xrn$age=state.ageInTicks;xrn$id=state.id;xrn$motion=motion;xrn$strength=CapeMouvement.intensite;xrn$surface.calculer(state.ageInTicks,state.id,motion);
  for(int i=0;i<xrn$cubes.size();i++){
   float p=(xrn$surface.angles[i]+xrn$surface.angles[i+1])*.5f,s=(xrn$surface.lateraux[i]+xrn$surface.lateraux[i+1])*.5f;
   for(int q=0;q<xrn$rest[i].length;q++){
    ModelPart.Polygon rest=xrn$rest[i][q];ModelPart.Vertex[] vertices=new ModelPart.Vertex[4];
    for(int k=0;k<4;k++){ModelPart.Vertex v=rest.vertices()[k];float[] point=xrn$surface.coin(v.x(),v.y(),v.z());vertices[k]=new ModelPart.Vertex(point[0],point[1],point[2],v.u(),v.v());}
    xrn$cubes.get(i).polygons[q]=new ModelPart.Polygon(vertices,new Vector3f(rest.normal()).rotateZ(s).rotateX(p));
   }
  }
 }
}
