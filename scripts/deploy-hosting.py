#!/usr/bin/env python3
"""Deploy dynamic Firebase Hosting rewrite and server-only Firestore rules.
Authentication: existing gcloud login. Never prints or stores access tokens.
"""
import json,os,subprocess,urllib.request
project=os.environ.get('PROJECT_ID','gen-lang-client-0444960702')
site=os.environ.get('SITE_ID','sideb-records')
region=os.environ.get('REGION','us-central1')
service=os.environ.get('SERVICE_NAME','side-b')
database=os.environ.get('FIRESTORE_DATABASE_ID','side-b')
token=subprocess.check_output(['gcloud','auth','print-access-token'],text=True).strip()
def request(method,url,body=None):
 req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','x-goog-user-project':project})
 try:
  with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
 except urllib.error.HTTPError as error:
  raise SystemExit(f'Deployment failed ({error.code}): '+error.read().decode())
# The named database is accessible only through server IAM. No browser SDK access.
rules=open('firestore.rules').read()
ruleset=request('POST','https://firebaserules.googleapis.com/v1/projects/'+project+'/rulesets',{'source':{'files':[{'name':'firestore.rules','content':rules}]}})
release='projects/'+project+'/releases/cloud.firestore/'+database
try:request('PATCH','https://firebaserules.googleapis.com/v1/'+release,{'release':{'name':release,'rulesetName':ruleset['name']}})
except SystemExit as e:
 if '404' not in str(e):raise
 request('POST','https://firebaserules.googleapis.com/v1/projects/'+project+'/releases',{'name':release,'rulesetName':ruleset['name']})
base='https://firebasehosting.googleapis.com/v1beta1/'
v=request('POST',base+f'sites/{site}/versions',{'config':{'headers':[{'glob':'**','headers':{'Cache-Control':'no-store'}}],'rewrites':[{'glob':'**','run':{'serviceId':service,'region':region}}]}})
name=v['name']
request('POST',base+name+':populateFiles',{'files':{}})
request('PATCH',base+name+'?updateMask=status',{'status':'FINALIZED'})
r=request('POST',base+f'sites/{site}/releases?versionName={name}',{})
print(json.dumps({'url':f'https://{site}.web.app','hostingVersion':name,'release':r.get('name'),'ruleset':ruleset['name']},indent=2))
