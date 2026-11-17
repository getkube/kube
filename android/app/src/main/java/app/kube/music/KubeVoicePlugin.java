package app.kube.music;
import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.ArrayList;

@CapacitorPlugin(name="KubeVoice",permissions={@Permission(alias="microphone",strings={Manifest.permission.RECORD_AUDIO})})
public class KubeVoicePlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private int session;
    private String permissionCallId;
    private boolean supported(){return Build.VERSION.SDK_INT>=31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());}
    private void release(){session++;if(recognizer!=null){recognizer.cancel();recognizer.destroy();recognizer=null;}}
    private void emit(String phase,String text,float level){JSObject event=new JSObject();event.put("phase",phase);event.put("text",text);event.put("level",level);notifyListeners("voice",event);}
    @PluginMethod public void available(PluginCall call){getActivity().runOnUiThread(()->{JSObject result=new JSObject();result.put("available",supported());call.resolve(result);});}
    @PluginMethod public void start(PluginCall call){
        if(!supported()){call.reject("On-device speech recognition is unavailable. You can still type your search.");return;}
        if(getPermissionState("microphone")!=PermissionState.GRANTED){permissionCallId=call.getCallbackId();requestPermissionForAlias("microphone",call,"microphoneResult");return;}
        getActivity().runOnUiThread(()->{
            release(); if(Build.VERSION.SDK_INT<31){call.reject("Local speech recognition requires Android 12 or newer.");return;} final int token=session;
            try{
                // This factory requires local recognition; never use the cloud-capable default factory.
                recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener(){
                    public void onReadyForSpeech(Bundle data){if(token==session)emit("listening","",0);}
                    public void onBeginningOfSpeech(){}
                    public void onRmsChanged(float rms){if(token==session)emit("level","",Math.max(0,Math.min(1,(rms+2)/12)));}
                    public void onBufferReceived(byte[] buffer){}
                    public void onEndOfSpeech(){}
                    public void onError(int code){if(token!=session)return;emit("error",code==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS?"Microphone permission was denied.":"Local speech recognition could not complete. Check the installed speech language or try again.",0);release();}
                    private void results(Bundle data,boolean complete){if(token!=session)return;ArrayList<String> values=data.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(values!=null&&!values.isEmpty())emit("result",values.get(0),0);if(complete){emit("ended","",0);release();}}
                    public void onResults(Bundle data){results(data,true);}
                    public void onPartialResults(Bundle data){results(data,false);}
                    public void onEvent(int type,Bundle data){}
                });
                Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,call.getString("language","en-GB"));intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
                recognizer.startListening(intent);call.resolve();
            }catch(Exception error){release();call.reject("Could not start local speech recognition. You can still type your search.");}
        });
    }
    @PermissionCallback private void microphoneResult(PluginCall call){if(!call.getCallbackId().equals(permissionCallId)){call.reject("Voice search was cancelled.");return;}permissionCallId=null;if(getPermissionState("microphone")==PermissionState.GRANTED)start(call);else call.reject("Microphone permission was denied.");}
    @PluginMethod public void stop(PluginCall call){permissionCallId=null;getActivity().runOnUiThread(()->{release();emit("ended","",0);call.resolve();});}
    @Override protected void handleOnDestroy(){permissionCallId=null;getActivity().runOnUiThread(this::release);}
}
